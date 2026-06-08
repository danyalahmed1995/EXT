/**
 * navigationProfiler.ts
 *
 * Comprehensive browser-side navigation performance profiler for the EXT app.
 * Measures real performance during tab switches and file selections, including:
 *   - Long main-thread tasks (>50 ms)
 *   - Frame drops via rAF loop
 *   - CodeMirror state/view timings
 *   - Block indexing, outline generation, preview mount/unmount
 *   - DOMPurify / sanitization cost
 *   - Worker message counts
 *
 * Usage:
 *   import { startProfiling, stopProfiling, startNavigation, endNavigation,
 *            perfMark, perfMeasure, runNavigationProfile } from './navigationProfiler';
 *
 *   // Or from browser console:
 *   window.__NAV_PROFILER.start();
 *   window.__NAV_PROFILER.stop();
 *   window.__NAV_PROFILER.runProfile(['tab-1','tab-2'], 5);
 */

// ─── Prefix ────────────────────────────────────────────────────────────────
const LOG_PREFIX = '[NavigationPerf]';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Data written by other components via window.__NAV_PERF */
export interface NavPerfData {
  cmStateCreate?: number;   // ms for EditorState.create
  cmSetState?: number;      // ms for view.setState
  cmViewUpdate?: number;    // ms for view update cycle
  indexBlocks?: number;     // ms for block indexing
  outlineGen?: number;      // ms for outline generation
  previewMount?: number;    // ms for preview mount
  previewUnmount?: number;  // ms for preview unmount
  mathDetect?: number;      // ms for math detection regex
  sanitize?: number;        // ms for DOMPurify sanitization
  workerMessages?: number;  // count of worker messages during navigation
}

export interface LongTaskEntry {
  startTime: number;   // relative to performance.timeOrigin
  duration: number;    // ms
  name: string;
}

export interface FrameDelayEntry {
  timestamp: number;
  delta: number;       // ms since previous frame
}

export interface NavigationTiming {
  id: string;
  fromTabId: string;
  toTabId: string;
  startTime: number;           // performance.now()
  endTime: number;
  totalMs: number;
  /** Time to visual active-tab highlight */
  tabActiveMs?: number;
  /** Time until editor is interactive */
  editorUsableMs?: number;
  /** Snapshot of component timings collected during this navigation */
  componentTimings: NavPerfData;
  /** Long tasks that fired during this navigation */
  longTasks: LongTaskEntry[];
  /** Max frame delay observed during this navigation */
  maxFrameDelay: number;
  /** All frame delays > 20 ms during this navigation */
  droppedFrames: FrameDelayEntry[];
}

export interface ProfileSummary {
  count: number;
  mean: number;
  median: number;
  p95: number;
  min: number;
  max: number;
  stddev: number;
}

export interface ProfileReport {
  startedAt: string;
  finishedAt: string;
  iterations: number;
  tabIds: string[];
  navigations: NavigationTiming[];
  allLongTasks: LongTaskEntry[];
  maxFrameDelay: number;
  frameDelayHistogram: { bucket: string; count: number }[];
  summary: {
    totalMs: ProfileSummary;
    cmStateCreate: ProfileSummary;
    cmSetState: ProfileSummary;
    cmViewUpdate: ProfileSummary;
    indexBlocks: ProfileSummary;
    outlineGen: ProfileSummary;
    previewMount: ProfileSummary;
    sanitize: ProfileSummary;
  };
}

// ─── Global data slot ──────────────────────────────────────────────────────

declare global {
  interface Window {
    __NAV_PERF: NavPerfData;
    __NAV_PROFILER: typeof profilerAPI;
  }
}

function resetNavPerfData(): NavPerfData {
  const empty: NavPerfData = {
    workerMessages: 0,
  };
  window.__NAV_PERF = empty;
  return empty;
}

// Ensure the global slot exists immediately on import
if (typeof window !== 'undefined') {
  if (!window.__NAV_PERF) resetNavPerfData();
}

// ─── Internal State ────────────────────────────────────────────────────────

let _isRunning = false;

// Long Task observer
let _longTaskObserver: PerformanceObserver | null = null;
const _longTasks: LongTaskEntry[] = [];

// Frame delay monitor
let _rafId: number | null = null;
let _lastFrameTime = 0;
const _frameDelays: FrameDelayEntry[] = [];
let _maxFrameDelay = 0;

// Active navigation tracking
let _activeNav: {
  fromTabId: string;
  toTabId: string;
  startTime: number;
  longTaskSnapshot: number; // index into _longTasks at nav start
  frameDelaySnapshot: number;
} | null = null;

// Completed navigations for reporting
const _navigations: NavigationTiming[] = [];

// Performance marks registry (name → startTime)
const _marks = new Map<string, number>();

// ─── Long Task Observer ────────────────────────────────────────────────────

function startLongTaskObserver(): void {
  if (typeof PerformanceObserver === 'undefined') {
    console.warn(`${LOG_PREFIX} PerformanceObserver not available – long task detection disabled`);
    return;
  }

  try {
    _longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const lt: LongTaskEntry = {
          startTime: entry.startTime,
          duration: entry.duration,
          name: entry.name || 'self',
        };
        _longTasks.push(lt);
        if (entry.duration > 100) {
          console.warn(
            `${LOG_PREFIX} ⚠ Long task: ${entry.duration.toFixed(1)} ms @ ${entry.startTime.toFixed(0)}`,
          );
        }
      }
    });
    _longTaskObserver.observe({ type: 'longtask', buffered: false });
    console.log(`${LOG_PREFIX} Long task observer started`);
  } catch {
    console.warn(`${LOG_PREFIX} 'longtask' observer type not supported – using rAF-based detection only`);
  }
}

function stopLongTaskObserver(): void {
  if (_longTaskObserver) {
    _longTaskObserver.disconnect();
    _longTaskObserver = null;
  }
}

// ─── Frame Delay Monitor ───────────────────────────────────────────────────

function frameLoop(now: number): void {
  if (_lastFrameTime > 0) {
    const delta = now - _lastFrameTime;
    if (delta > 20) {
      // Anything over ~20 ms is a potential dropped frame (60 fps = 16.67 ms)
      _frameDelays.push({ timestamp: now, delta });
      if (delta > _maxFrameDelay) _maxFrameDelay = delta;

      if (delta > 50) {
        console.warn(
          `${LOG_PREFIX} 🖼 Frame drop: ${delta.toFixed(1)} ms gap @ ${now.toFixed(0)}`,
        );
      }
    }
  }
  _lastFrameTime = now;
  _rafId = requestAnimationFrame(frameLoop);
}

function startFrameMonitor(): void {
  if (_rafId !== null) return;
  _lastFrameTime = 0;
  _rafId = requestAnimationFrame(frameLoop);
  console.log(`${LOG_PREFIX} Frame delay monitor started`);
}

function stopFrameMonitor(): void {
  if (_rafId !== null) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
}

// ─── Performance Marks / Measures ──────────────────────────────────────────

/**
 * Start a named performance mark.
 * Call `perfMeasure(label)` with the same label to complete and log the duration.
 */
export function perfMark(label: string): void {
  const markName = `nav-perf:${label}`;
  performance.mark(markName);
  _marks.set(label, performance.now());
}

/**
 * End a performance mark started with `perfMark(label)`.
 * Logs the duration and returns it in milliseconds.
 */
export function perfMeasure(label: string): number {
  const markName = `nav-perf:${label}`;
  const measureName = `nav-perf-measure:${label}`;

  const start = _marks.get(label);
  if (start === undefined) {
    console.warn(`${LOG_PREFIX} perfMeasure called without matching perfMark for "${label}"`);
    return 0;
  }

  try {
    performance.measure(measureName, markName);
    const entries = performance.getEntriesByName(measureName, 'measure');
    const duration = entries.length > 0 ? entries[entries.length - 1].duration : performance.now() - start;

    console.log(`${LOG_PREFIX} ⏱ ${label}: ${duration.toFixed(2)} ms`);

    // Clean up
    performance.clearMarks(markName);
    performance.clearMeasures(measureName);
    _marks.delete(label);

    return duration;
  } catch {
    // Fallback if measure API fails
    const duration = performance.now() - start;
    console.log(`${LOG_PREFIX} ⏱ ${label}: ${duration.toFixed(2)} ms (fallback)`);
    _marks.delete(label);
    return duration;
  }
}

// ─── Navigation Tracking ───────────────────────────────────────────────────

/**
 * Begin tracking a tab-switch navigation.
 * Call `endNavigation()` when the navigation is visually complete.
 */
export function startNavigation(fromTabId: string, toTabId: string): void {
  // If a previous navigation was not ended, force-end it
  if (_activeNav) {
    console.warn(`${LOG_PREFIX} Previous navigation (${_activeNav.fromTabId} → ${_activeNav.toTabId}) was not ended. Force-ending.`);
    endNavigation();
  }

  // Reset component timing slot
  resetNavPerfData();

  const now = performance.now();
  performance.mark('nav-perf:navigation-start');

  _activeNav = {
    fromTabId,
    toTabId,
    startTime: now,
    longTaskSnapshot: _longTasks.length,
    frameDelaySnapshot: _frameDelays.length,
  };

  console.log(`${LOG_PREFIX} 🚀 Navigation started: ${fromTabId} → ${toTabId}`);
}

/**
 * End the current navigation measurement.
 * Collects all timing data and logs a summary.
 */
export function endNavigation(): NavigationTiming | null {
  if (!_activeNav) {
    console.warn(`${LOG_PREFIX} endNavigation called but no active navigation`);
    return null;
  }

  const endTime = performance.now();
  performance.mark('nav-perf:navigation-end');

  let totalMs = endTime - _activeNav.startTime;
  try {
    performance.measure('nav-perf-measure:navigation', 'nav-perf:navigation-start', 'nav-perf:navigation-end');
    const entries = performance.getEntriesByName('nav-perf-measure:navigation', 'measure');
    if (entries.length > 0) totalMs = entries[entries.length - 1].duration;
    performance.clearMarks('nav-perf:navigation-start');
    performance.clearMarks('nav-perf:navigation-end');
    performance.clearMeasures('nav-perf-measure:navigation');
  } catch { /* use fallback totalMs */ }

  // Collect long tasks that happened during this navigation
  const navLongTasks = _longTasks.slice(_activeNav.longTaskSnapshot);

  // Collect frame delays during this navigation
  const navFrameDelays = _frameDelays.slice(_activeNav.frameDelaySnapshot);
  const navMaxFrameDelay = navFrameDelays.reduce((max, f) => Math.max(max, f.delta), 0);

  // Snapshot component timings
  const componentTimings: NavPerfData = { ...window.__NAV_PERF };

  const timing: NavigationTiming = {
    id: `nav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fromTabId: _activeNav.fromTabId,
    toTabId: _activeNav.toTabId,
    startTime: _activeNav.startTime,
    endTime,
    totalMs,
    componentTimings,
    longTasks: navLongTasks,
    maxFrameDelay: navMaxFrameDelay,
    droppedFrames: navFrameDelays,
  };

  _navigations.push(timing);
  _activeNav = null;

  // ── Console summary ──
  console.groupCollapsed(
    `${LOG_PREFIX} ✅ Navigation complete: ${timing.fromTabId} → ${timing.toTabId} — ${totalMs.toFixed(1)} ms`,
  );
  console.table({
    'Total': `${totalMs.toFixed(1)} ms`,
    'CM State Create': componentTimings.cmStateCreate != null ? `${componentTimings.cmStateCreate.toFixed(1)} ms` : '—',
    'CM setState': componentTimings.cmSetState != null ? `${componentTimings.cmSetState.toFixed(1)} ms` : '—',
    'CM View Update': componentTimings.cmViewUpdate != null ? `${componentTimings.cmViewUpdate.toFixed(1)} ms` : '—',
    'Index Blocks': componentTimings.indexBlocks != null ? `${componentTimings.indexBlocks.toFixed(1)} ms` : '—',
    'Outline Gen': componentTimings.outlineGen != null ? `${componentTimings.outlineGen.toFixed(1)} ms` : '—',
    'Preview Mount': componentTimings.previewMount != null ? `${componentTimings.previewMount.toFixed(1)} ms` : '—',
    'Preview Unmount': componentTimings.previewUnmount != null ? `${componentTimings.previewUnmount.toFixed(1)} ms` : '—',
    'Sanitize': componentTimings.sanitize != null ? `${componentTimings.sanitize.toFixed(1)} ms` : '—',
    'Math Detect': componentTimings.mathDetect != null ? `${componentTimings.mathDetect.toFixed(1)} ms` : '—',
    'Worker Msgs': componentTimings.workerMessages ?? 0,
    'Long Tasks': navLongTasks.length,
    'Max Frame Delay': `${navMaxFrameDelay.toFixed(1)} ms`,
    'Dropped Frames': navFrameDelays.length,
  });
  if (navLongTasks.length > 0) {
    console.log(`${LOG_PREFIX} Long tasks during navigation:`);
    console.table(navLongTasks.map(t => ({
      duration: `${t.duration.toFixed(1)} ms`,
      startTime: `${t.startTime.toFixed(0)}`,
      name: t.name,
    })));
  }
  console.groupEnd();

  return timing;
}

/**
 * Record the "tab visually active" timestamp relative to navigation start.
 * Call this from the tab component's effect when the active class is applied.
 */
export function markTabActive(): void {
  if (!_activeNav) return;
  const elapsed = performance.now() - _activeNav.startTime;
  console.log(`${LOG_PREFIX} 🏷 Tab active state: ${elapsed.toFixed(1)} ms`);
  // Will be picked up by endNavigation via last navigation entry
  if (_navigations.length > 0) {
    // Attach to last partial if available, otherwise store on active
  }
  // Store for retrieval
  (window as any).__NAV_PERF_TAB_ACTIVE = elapsed;
}

/**
 * Record the "editor usable" timestamp relative to navigation start.
 * Call this once CodeMirror view is fully rendered and accepting input.
 */
export function markEditorUsable(): void {
  if (!_activeNav) return;
  const elapsed = performance.now() - _activeNav.startTime;
  console.log(`${LOG_PREFIX} 🏷 Editor usable: ${elapsed.toFixed(1)} ms`);
  (window as any).__NAV_PERF_EDITOR_USABLE = elapsed;
}

// ─── Worker Message Counter ────────────────────────────────────────────────

/**
 * Increment the worker message counter for the current navigation.
 * Call this every time a worker posts a message back during navigation.
 */
export function countWorkerMessage(): void {
  if (window.__NAV_PERF) {
    window.__NAV_PERF.workerMessages = (window.__NAV_PERF.workerMessages || 0) + 1;
  }
}

// ─── Start / Stop ──────────────────────────────────────────────────────────

/**
 * Start the profiler (long task observer + frame monitor).
 * Safe to call multiple times; will not double-start.
 */
export function startProfiling(): void {
  if (_isRunning) {
    console.log(`${LOG_PREFIX} Profiler already running`);
    return;
  }
  _isRunning = true;

  // Clear previous data
  _longTasks.length = 0;
  _frameDelays.length = 0;
  _maxFrameDelay = 0;
  _navigations.length = 0;
  resetNavPerfData();

  startLongTaskObserver();
  startFrameMonitor();

  console.log(
    `${LOG_PREFIX} ✅ Profiler started. Use startNavigation() / endNavigation() to track tab switches.`,
  );
}

/**
 * Stop the profiler and log a final summary.
 */
export function stopProfiling(): void {
  if (!_isRunning) {
    console.log(`${LOG_PREFIX} Profiler is not running`);
    return;
  }

  stopLongTaskObserver();
  stopFrameMonitor();
  _isRunning = false;

  console.groupCollapsed(`${LOG_PREFIX} 🛑 Profiler stopped — Final Summary`);
  console.log(`Total navigations tracked: ${_navigations.length}`);
  console.log(`Total long tasks: ${_longTasks.length}`);
  console.log(`Max frame delay: ${_maxFrameDelay.toFixed(1)} ms`);
  console.log(`Frame delays > 20ms: ${_frameDelays.length}`);

  if (_navigations.length > 0) {
    const totalTimes = _navigations.map(n => n.totalMs);
    console.log(`Navigation times (ms):`, totalTimes.map(t => t.toFixed(1)));
    console.log(`Mean: ${mean(totalTimes).toFixed(1)} ms`);
    console.log(`Median: ${median(totalTimes).toFixed(1)} ms`);
    console.log(`P95: ${percentile(totalTimes, 95).toFixed(1)} ms`);
  }
  console.groupEnd();
}

// ─── Statistics Helpers ────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeSummary(values: number[]): ProfileSummary {
  const filtered = values.filter(v => v != null && !isNaN(v));
  if (filtered.length === 0) {
    return { count: 0, mean: 0, median: 0, p95: 0, min: 0, max: 0, stddev: 0 };
  }
  return {
    count: filtered.length,
    mean: mean(filtered),
    median: median(filtered),
    p95: percentile(filtered, 95),
    min: Math.min(...filtered),
    max: Math.max(...filtered),
    stddev: stddev(filtered),
  };
}

// ─── Automated Test Runner ─────────────────────────────────────────────────

/**
 * Run an automated navigation profile by rapidly switching between tabs.
 *
 * @param tabIds  Array of tab element IDs or data-tab-ids to click
 * @param iterations  Number of full cycles through all tabs
 * @param delayBetweenMs  Wait time between each tab switch (default 300 ms)
 * @returns Structured ProfileReport
 *
 * Usage from console:
 *   window.__NAV_PROFILER.runProfile(['tab-1', 'tab-2', 'tab-3'], 5)
 */
export async function runNavigationProfile(
  tabIds: string[],
  iterations: number = 3,
  delayBetweenMs: number = 300,
): Promise<ProfileReport> {
  if (tabIds.length < 2) {
    throw new Error(`${LOG_PREFIX} Need at least 2 tab IDs to profile navigation`);
  }

  console.log(
    `${LOG_PREFIX} 🏁 Starting automated profile: ${tabIds.length} tabs × ${iterations} iterations (${delayBetweenMs} ms delay)`,
  );

  // Start fresh
  startProfiling();

  const startedAt = new Date().toISOString();
  const profileNavigations: NavigationTiming[] = [];

  const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  /**
   * Find and click a tab element.
   * Searches by data-tab-id attribute, then by id, then by text content.
   */
  function findAndClickTab(tabId: string): HTMLElement | null {
    // Strategy 1: data-tab-id attribute
    let el = document.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement | null;

    // Strategy 2: id attribute
    if (!el) el = document.getElementById(tabId);

    // Strategy 3: any tab-like element whose text includes the ID
    if (!el) {
      const candidates = Array.from(document.querySelectorAll('[role="tab"], .tab, .editor-tab'));
      for (const c of candidates) {
        if (c.textContent?.includes(tabId)) {
          el = c as HTMLElement;
          break;
        }
      }
    }

    if (el) {
      el.click();
      return el;
    }

    console.warn(`${LOG_PREFIX} Could not find tab element for "${tabId}"`);
    return null;
  }

  // Run iterations
  for (let iter = 0; iter < iterations; iter++) {
    console.log(`${LOG_PREFIX} ── Iteration ${iter + 1}/${iterations} ──`);

    for (let i = 0; i < tabIds.length; i++) {
      const fromIdx = i === 0 ? tabIds.length - 1 : i - 1;
      const fromTabId = tabIds[fromIdx];
      const toTabId = tabIds[i];

      // Skip first switch on first iteration (no "from" context)
      if (iter === 0 && i === 0) {
        findAndClickTab(toTabId);
        await delay(delayBetweenMs);
        continue;
      }

      startNavigation(fromTabId, toTabId);

      const clicked = findAndClickTab(toTabId);
      if (!clicked) {
        endNavigation();
        continue;
      }

      // Wait for navigation to settle:
      // - First, yield to microtasks and rAF
      // - Then wait for user-specified delay
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
      await delay(delayBetweenMs);

      const timing = endNavigation();
      if (timing) profileNavigations.push(timing);
    }
  }

  const finishedAt = new Date().toISOString();

  // Build frame delay histogram
  const buckets = [
    { label: '16-33ms', min: 16, max: 33, count: 0 },
    { label: '33-50ms', min: 33, max: 50, count: 0 },
    { label: '50-100ms', min: 50, max: 100, count: 0 },
    { label: '100-200ms', min: 100, max: 200, count: 0 },
    { label: '200-500ms', min: 200, max: 500, count: 0 },
    { label: '500ms+', min: 500, max: Infinity, count: 0 },
  ];
  for (const fd of _frameDelays) {
    for (const b of buckets) {
      if (fd.delta >= b.min && fd.delta < b.max) { b.count++; break; }
    }
  }

  // Compute summaries
  const totalTimes = profileNavigations.map(n => n.totalMs);
  const extract = (key: keyof NavPerfData) =>
    profileNavigations.map(n => n.componentTimings[key] as number).filter(v => v != null);

  const report: ProfileReport = {
    startedAt,
    finishedAt,
    iterations,
    tabIds,
    navigations: profileNavigations,
    allLongTasks: [..._longTasks],
    maxFrameDelay: _maxFrameDelay,
    frameDelayHistogram: buckets.map(b => ({ bucket: b.label, count: b.count })),
    summary: {
      totalMs: computeSummary(totalTimes),
      cmStateCreate: computeSummary(extract('cmStateCreate')),
      cmSetState: computeSummary(extract('cmSetState')),
      cmViewUpdate: computeSummary(extract('cmViewUpdate')),
      indexBlocks: computeSummary(extract('indexBlocks')),
      outlineGen: computeSummary(extract('outlineGen')),
      previewMount: computeSummary(extract('previewMount')),
      sanitize: computeSummary(extract('sanitize')),
    },
  };

  stopProfiling();

  // ── Print report ──
  console.group(`${LOG_PREFIX} 📊 Profile Report`);
  console.log(`Duration: ${startedAt} → ${finishedAt}`);
  console.log(`Tabs: ${tabIds.join(', ')}`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Total navigations measured: ${profileNavigations.length}`);
  console.log('');

  console.log(`── Overall Navigation Time ──`);
  printSummary('Total (ms)', report.summary.totalMs);
  console.log('');

  console.log(`── Component Breakdown ──`);
  printSummary('CM State Create', report.summary.cmStateCreate);
  printSummary('CM setState', report.summary.cmSetState);
  printSummary('CM View Update', report.summary.cmViewUpdate);
  printSummary('Index Blocks', report.summary.indexBlocks);
  printSummary('Outline Gen', report.summary.outlineGen);
  printSummary('Preview Mount', report.summary.previewMount);
  printSummary('Sanitize', report.summary.sanitize);
  console.log('');

  console.log(`── Frame Delay Histogram ──`);
  console.table(report.frameDelayHistogram);

  console.log(`── Long Tasks: ${report.allLongTasks.length} total ──`);
  if (report.allLongTasks.length > 0) {
    console.table(report.allLongTasks.map(t => ({
      duration: `${t.duration.toFixed(1)} ms`,
      startTime: t.startTime.toFixed(0),
    })));
  }

  console.log(`Max frame delay: ${report.maxFrameDelay.toFixed(1)} ms`);
  console.groupEnd();

  return report;
}

function printSummary(label: string, s: ProfileSummary): void {
  if (s.count === 0) {
    console.log(`  ${label}: no data`);
    return;
  }
  console.log(
    `  ${label}: mean=${s.mean.toFixed(1)}  median=${s.median.toFixed(1)}  p95=${s.p95.toFixed(1)}  min=${s.min.toFixed(1)}  max=${s.max.toFixed(1)}  stddev=${s.stddev.toFixed(1)}  (n=${s.count})`,
  );
}

// ─── Convenience: Timed Wrapper ────────────────────────────────────────────

/**
 * Wrap a synchronous or async function with timing, writing results to __NAV_PERF.
 *
 * Example:
 *   const blocks = timedExec('indexBlocks', () => indexBlocks(content));
 */
export function timedExec<T>(key: keyof NavPerfData, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const elapsed = performance.now() - start;
  if (window.__NAV_PERF) {
    (window.__NAV_PERF as any)[key] = elapsed;
  }
  if (elapsed > 5) {
    console.log(`${LOG_PREFIX} ⏱ ${key}: ${elapsed.toFixed(2)} ms`);
  }
  return result;
}

/**
 * Async version of timedExec.
 */
export async function timedExecAsync<T>(key: keyof NavPerfData, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const elapsed = performance.now() - start;
  if (window.__NAV_PERF) {
    (window.__NAV_PERF as any)[key] = elapsed;
  }
  if (elapsed > 5) {
    console.log(`${LOG_PREFIX} ⏱ ${key}: ${elapsed.toFixed(2)} ms`);
  }
  return result;
}

// ─── Quick Snapshot (for debugging) ────────────────────────────────────────

/**
 * Print a snapshot of the current __NAV_PERF data to the console.
 */
export function snapshot(): NavPerfData {
  const data = { ...window.__NAV_PERF };
  console.log(`${LOG_PREFIX} Current __NAV_PERF snapshot:`, data);
  return data;
}

/**
 * Get all completed navigation timings.
 */
export function getNavigations(): NavigationTiming[] {
  return [..._navigations];
}

/**
 * Clear all stored profiling data.
 */
export function clearData(): void {
  _longTasks.length = 0;
  _frameDelays.length = 0;
  _maxFrameDelay = 0;
  _navigations.length = 0;
  resetNavPerfData();
  console.log(`${LOG_PREFIX} All profiling data cleared`);
}

// ─── Global API (accessible from DevTools console) ─────────────────────────

const profilerAPI = {
  start: startProfiling,
  stop: stopProfiling,
  startNav: startNavigation,
  endNav: endNavigation,
  markTabActive,
  markEditorUsable,
  mark: perfMark,
  measure: perfMeasure,
  snapshot,
  getNavigations,
  clearData,
  countWorkerMessage,
  runProfile: runNavigationProfile,
  timedExec,
  timedExecAsync,

  /** Quick status check */
  status() {
    console.log(`${LOG_PREFIX} Running: ${_isRunning}`);
    console.log(`${LOG_PREFIX} Navigations recorded: ${_navigations.length}`);
    console.log(`${LOG_PREFIX} Long tasks: ${_longTasks.length}`);
    console.log(`${LOG_PREFIX} Frame delays >20ms: ${_frameDelays.length}`);
    console.log(`${LOG_PREFIX} Max frame delay: ${_maxFrameDelay.toFixed(1)} ms`);
    console.log(`${LOG_PREFIX} Active navigation: ${_activeNav ? `${_activeNav.fromTabId} → ${_activeNav.toTabId}` : 'none'}`);
  },

  /** Print usage guide */
  help() {
    console.log(`
${LOG_PREFIX} ═══════════════════════════════════════════════
${LOG_PREFIX}  EXT Navigation Performance Profiler
${LOG_PREFIX} ═══════════════════════════════════════════════

  Manual profiling:
    __NAV_PROFILER.start()                         Start observers
    __NAV_PROFILER.startNav('tab-1', 'tab-2')      Begin tracking a switch
    __NAV_PROFILER.endNav()                         End tracking & print results
    __NAV_PROFILER.stop()                           Stop observers & summarize

  Automated:
    __NAV_PROFILER.runProfile(['t1','t2','t3'], 5)  Run 5 cycles, get report

  Utilities:
    __NAV_PROFILER.mark('label')                    Start a perf mark
    __NAV_PROFILER.measure('label')                 End & log mark
    __NAV_PROFILER.snapshot()                        Print __NAV_PERF data
    __NAV_PROFILER.status()                          Current profiler status
    __NAV_PROFILER.clearData()                       Reset all data

  From components:
    window.__NAV_PERF.cmStateCreate = elapsed;      Write timing data
    countWorkerMessage();                            Increment worker msg count
`);
  },
};

// Install global API
if (typeof window !== 'undefined') {
  window.__NAV_PROFILER = profilerAPI;
}

// ─── Default Export ────────────────────────────────────────────────────────

export default profilerAPI;
