/**
 * EXT Large Markdown Benchmark – Demand-Driven Edition
 *
 * Simulates the actual app architecture:
 *   1. Index source blocks  (lightweight string scan)
 *   2. Pick a viewport's worth of blocks (VIEWPORT_BLOCKS)
 *   3. Render those blocks in a background worker
 *   4. Sanitize the HTML on the main thread (via JSDOM + DOMPurify)
 *   5. Track event-loop heartbeat for main-thread blocking
 *
 * Pass / Fail criteria:
 *   • No crash / OOM
 *   • Main-thread max block time  < 200 ms
 *   • Visible blocks render successfully
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { Worker } from 'worker_threads';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { indexBlocks } from './blockIndexer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const BENCHMARK_DIR = path.join(PROJECT_ROOT, 'Benchmark Files');
const REPORT_DIR    = path.join(BENCHMARK_DIR, 'report');

const window    = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/** How many blocks to render per file (simulates visible viewport + overscan) */
const VIEWPORT_BLOCKS = 20;
/** Main-thread block-time threshold */
const MAX_BLOCK_MS = 200;

async function runBenchmark() {
  console.log('--- EXT Large Markdown Benchmark (Demand-Driven) ---');

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORT_DIR, `report-${dateStr}.txt`);

  const log = (t) => { process.stdout.write(t + '\n'); fs.appendFileSync(reportPath, t + '\n'); };

  log('==================================================');
  log(`Date/Time: ${new Date().toLocaleString()}`);
  log(`OS: ${os.type()} ${os.release()} ${os.arch()}`);
  log(`Node: ${process.version}`);
  log(`App: ${pkg.version}`);
  log(`GC Exposed: ${typeof global.gc === 'function' ? 'Yes' : 'No'}`);
  log(`Viewport Blocks: ${VIEWPORT_BLOCKS}`);
  log('==================================================\n');

  const folders = ['ext-large-md-no-latex', 'ext-large-md-with-latex', 'ext-broken-latex-5mb-md-pack'];
  let totalFiles = 0, passed = 0, failed = 0;

  for (const folder of folders) {
    const folderPath = path.join(BENCHMARK_DIR, folder);
    if (!fs.existsSync(folderPath)) continue;
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
    if (files.length === 0) continue;

    const category = folder.includes('no-latex') ? 'Normal Markdown' : 'LaTeX Markdown';
    log(`\n--- CATEGORY: ${category} (${folder}) ---`);

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
      log(`\nFile: ${file}`);
      log(`Size: ${sizeMB} MB`);

      try {
        if (typeof global.gc === 'function') global.gc();
        const memBefore = process.memoryUsage().heapUsed;

        // ── 1. Read ─────────────────────────────
        const t0 = performance.now();
        const content = fs.readFileSync(filePath, 'utf8');
        const readMs = performance.now() - t0;

        // ── 2. Index blocks ─────────────────────
        const t1 = performance.now();
        const blocks = indexBlocks(content);
        const indexMs = performance.now() - t1;

        const mathBlocks = blocks.filter(b => b.mathHeavy).length;

        // ── 3. Start heartbeat & Input Simulation ────────────────
        let maxDelay = 0;
        let lastBeat = performance.now();
        const hb = setInterval(() => {
          const now = performance.now();
          const d = now - lastBeat - 10;
          if (d > maxDelay) maxDelay = d;
          lastBeat = now;
        }, 10);

        let maxInputDelay = 0;
        let isTyping = false;
        let globalResumeQueue = null;
        // Simulate editor typing events every 150ms
        const inputSim = setInterval(() => {
          const start = performance.now();
          // Simulate the editor event loop queuing a keystroke
          setTimeout(() => {
             const delay = performance.now() - start;
             if (delay > maxInputDelay) maxInputDelay = delay;
             isTyping = true;
             // Simulate user pausing after typing
             setTimeout(() => { 
                isTyping = false; 
                if (globalResumeQueue) globalResumeQueue();
             }, 50); 
          }, 0);
        }, 150);

        // ── 4. Render visible blocks via worker (Scroll Simulation) ─
        const worker = new Worker(path.join(__dirname, 'benchmarkWorker.js'));
        let workerRenderMs = 0;
        let blocksRendered = 0;
        let injectMs = 0;

        const renderViewport = async (viewportBlocks) => {
          if (viewportBlocks.length === 0) return;
          await new Promise((resolve, reject) => {
            let remaining = viewportBlocks.length;
            let purifyQueue = [];
            let isPurifying = false;

            const processPurifyQueue = () => {
              if (purifyQueue.length === 0) {
                isPurifying = false;
                return;
              }
              // Simulate strict safety mode pausing
              if (isTyping) {
                 isPurifying = false;
                 return;
              }
              
              isPurifying = true;
              globalResumeQueue = () => { if (!isPurifying && purifyQueue.length > 0) processPurifyQueue(); };
              
              // Simulate requestIdleCallback
              setTimeout(() => {
                if (isTyping || purifyQueue.length === 0) { 
                  isPurifying = false; 
                  return; 
                }
                
                const msg = purifyQueue.shift();
                const s = performance.now();
                const safe = DOMPurify.sanitize(msg.html);
                
                // Simulate DOM Injection layout hit
                const el = window.document.createElement('div');
                el.innerHTML = safe;
                window.document.body.appendChild(el);
                
                injectMs += (performance.now() - s);
                remaining--;
                
                if (remaining <= 0) { 
                  worker.off('message', listener); 
                  resolve(); 
                } else {
                  processPurifyQueue();
                }
              }, 1);
            };

            const listener = (msg) => {
              if (msg.type === 'block-result') {
                workerRenderMs += msg.renderMs;
                blocksRendered++;
                purifyQueue.push(msg);
                if (!isPurifying) {
                  processPurifyQueue();
                }
              } else if (msg.type === 'block-error') {
                remaining--;
                if (remaining <= 0) { worker.off('message', listener); resolve(); }
              }
            };
            worker.on('message', listener);
            worker.on('error', reject);

            for (const b of viewportBlocks) {
              worker.postMessage({
                type: 'render-block',
                renderId: 1,
                blockId: b.id,
                source: b.source,
              });
            }
          });
        };

        // Scroll simulation: Top -> Middle -> Bottom
        const topBlocks = blocks.slice(0, VIEWPORT_BLOCKS);
        const midIndex = Math.floor(blocks.length / 2);
        const midBlocks = blocks.slice(midIndex, midIndex + VIEWPORT_BLOCKS);
        const botIndex = Math.max(0, blocks.length - VIEWPORT_BLOCKS);
        const botBlocks = blocks.slice(botIndex, botIndex + VIEWPORT_BLOCKS);

        await renderViewport(topBlocks);
        await renderViewport(midBlocks);
        await renderViewport(botBlocks);

        worker.terminate();
        clearInterval(hb);
        clearInterval(inputSim);

        const memAfter = process.memoryUsage().heapUsed;
        const memDelta = Math.max(0, (memAfter - memBefore) / (1024 * 1024));
        if (typeof global.gc === 'function') global.gc();

        // ── 5. Report ───────────────────────────
        const totalSimulatedBlocks = topBlocks.length + midBlocks.length + botBlocks.length;
        log(`Read Time: ${readMs.toFixed(2)} ms`);
        log(`Block Indexing Time: ${indexMs.toFixed(2)} ms`);
        log(`Total Source Blocks: ${blocks.length}`);
        log(`Math-Heavy Blocks: ${mathBlocks}`);
        log(`Viewport Blocks Rendered: ${blocksRendered}/${totalSimulatedBlocks}`);
        log(`Worker Render Time (sum): ${workerRenderMs.toFixed(2)} ms`);
        log(`Main Thread Sanitize & Layout: ${injectMs.toFixed(2)} ms`);
        log(`Main Thread Max Block Time: ${maxDelay.toFixed(2)} ms`);
        log(`Max Simulated Editor Input Delay: ${maxInputDelay.toFixed(2)} ms`);
        log(`Memory Delta: ${memDelta.toFixed(2)} MB`);

        const reasons = [];
        if (maxDelay > MAX_BLOCK_MS) {
          reasons.push(`Main thread blocked > ${MAX_BLOCK_MS}ms (${maxDelay.toFixed(0)}ms)`);
        }
        if (maxInputDelay > 50) {
          reasons.push(`Editor input delay > 50ms (${maxInputDelay.toFixed(0)}ms)`);
        }

        if (reasons.length === 0) {
          log(`Status: PASS`);
          log(`Editor Responsive: Yes`);
          passed++;
        } else {
          log(`Status: FAIL`);
          log(`Editor Responsive: No`);
          reasons.forEach(r => log(`  -> ${r}`));
          failed++;
        }
      } catch (err) {
        log(`Status: FAIL (Exception)`);
        log(`Error: ${err.message}`);
        failed++;
      }
    }
  }

  log('\n==================================================');
  log('SUMMARY');
  log('==================================================');
  log(`Total Files: ${totalFiles}`);
  log(`Passed: ${passed}`);
  log(`Failed: ${failed}`);
  log(`\nReport: ${reportPath}`);

  log('\n--- RAPID TAB SWITCH STRESS TEST (Bounded Caching) ---');
  try {
    const fileA = path.join(BENCHMARK_DIR, 'ext-large-md-with-latex', 'example_matrices_align.md');
    const fileB = path.join(BENCHMARK_DIR, 'ext-large-md-with-latex', 'example_long_lines_with_math.md');
    const fileC = path.join(BENCHMARK_DIR, 'ext-large-md-with-latex', 'example_tables_with_math.md');
    
    if (fs.existsSync(fileA) && fs.existsSync(fileB) && fs.existsSync(fileC)) {
      const contentA = fs.readFileSync(fileA, 'utf8');
      const contentB = fs.readFileSync(fileB, 'utf8');
      const contentC = fs.readFileSync(fileC, 'utf8');
      
      let staleInjectionDetected = false;
      let activeTabId = 'A';
      
      class PreviewInstance {
         constructor(tabId, content) {
           this.tabId = tabId;
           this.content = content;
           this.isMounted = true;
           this.isActive = false;
           this.purifyQueue = [];
           this.isPurifying = false;
           this.worker = null;
           this.switchDelayMs = 0;
           this.initialized = false;
         }

         mount() {
           const t0 = performance.now();
           // Simulate async indexing
           setTimeout(() => {
             if (!this.isMounted) return;
             const blocks = indexBlocks(this.content);
             const viewportBlocks = blocks.slice(0, VIEWPORT_BLOCKS);
             
             this.worker = new Worker(path.join(__dirname, 'benchmarkWorker.js'));
             
             this.worker.on('message', (msg) => {
               if (!this.isMounted) return;
               if (msg.type === 'block-result') {
                 this.purifyQueue.push(msg);
                 if (!this.isPurifying) this.processPurifyQueue();
               }
             });

             for (const b of viewportBlocks) {
               if (!this.isMounted) break;
               this.worker.postMessage({ type: 'render-block', renderId: 1, blockId: b.id, source: b.source });
             }
             this.initialized = true;
           }, 0);
           this.switchDelayMs = performance.now() - t0;
         }

         processPurifyQueue() {
            if (!this.isMounted || !this.isActive || this.purifyQueue.length === 0) {
              this.isPurifying = false;
              return;
            }
            this.isPurifying = true;
            setTimeout(() => {
              if (!this.isMounted || !this.isActive) { this.isPurifying = false; return; }
              const msg = this.purifyQueue.shift();
              
              if (activeTabId !== this.tabId) {
                staleInjectionDetected = true;
              }

              const safe = DOMPurify.sanitize(msg.html);
              const el = window.document.createElement('div');
              el.innerHTML = safe;
              el.setAttribute('data-tab', this.tabId);
              window.document.body.appendChild(el);

              if (this.purifyQueue.length > 0) this.processPurifyQueue();
              else this.isPurifying = false;
            }, 1);
         }

         setActive(active) {
            this.isActive = active;
            if (active && this.initialized && !this.isPurifying) {
              this.processPurifyQueue();
            }
         }

         unmount() {
            this.isMounted = false;
            if (this.worker) this.worker.terminate();
         }
      }

      // Start A (Active)
      const instanceA = new PreviewInstance('A', contentA);
      instanceA.isActive = true;
      instanceA.mount();

      // Simulate 100ms later: Hot switch to B (Mount B, deactivate A)
      let switchDelayHotMs = 0;
      let switchDelayColdMs = 0;
      
      await new Promise(r => setTimeout(r, 100));
      
      activeTabId = 'B';
      const switchB_T0 = performance.now();
      instanceA.setActive(false);
      const instanceB = new PreviewInstance('B', contentB);
      instanceB.isActive = true;
      instanceB.mount();
      switchDelayColdMs = instanceB.switchDelayMs; // First mount is cold

      await new Promise(r => setTimeout(r, 100));

      // Hot switch back to A (A is already mounted)
      activeTabId = 'A';
      const switchA_T0 = performance.now();
      instanceB.setActive(false);
      instanceA.setActive(true); // Should resume instantly
      switchDelayHotMs = performance.now() - switchA_T0;

      // Unmount B completely (evict)
      instanceB.unmount();

      await new Promise(r => setTimeout(r, 1000));
      instanceA.unmount();

      log(`Cold Tab Switch Blocking Time: ${switchDelayColdMs.toFixed(2)} ms`);
      log(`Hot Tab Switch Blocking Time: ${switchDelayHotMs.toFixed(2)} ms`);
      log(`Stale Injection Detected: ${staleInjectionDetected ? 'YES' : 'NO'}`);

      if (switchDelayColdMs > 50 || switchDelayHotMs > 10 || staleInjectionDetected) {
        log(`Status: FAIL (Rapid Switch)`);
      } else {
        log(`Status: PASS (Rapid Switch)`);
      }
    } else {
      log('Skipped (test files not found)');
    }
  } catch (e) {
    log(`Status: FAIL (Exception in Tab Switch Test: ${e.message})`);
  }
}

runBenchmark().catch(console.error);
