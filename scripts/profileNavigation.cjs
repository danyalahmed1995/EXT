const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_PATH = path.join(PROJECT_ROOT, 'Benchmark Files');
const APP_URL = process.env.EXT_PROFILE_URL || 'http://127.0.0.1:1420';
const ITERATIONS = Number(process.env.EXT_PROFILE_ITERATIONS || 50);
const SWITCH_DELAY_MS = Number(process.env.EXT_PROFILE_SWITCH_DELAY_MS || 80);
const VIEW_MODE = process.env.EXT_PROFILE_VIEW_MODE || 'editor';
const SETTLE_AFTER_OPEN_MS = Number(process.env.EXT_PROFILE_SETTLE_AFTER_OPEN_MS || 1500);
const RUN_MANUAL_SMOKE = process.env.EXT_PROFILE_MANUAL === '1';
const PROGRESS_LOG = path.join(PROJECT_ROOT, 'Benchmark Files', 'report', 'navigation-profile-last.log');

fs.mkdirSync(path.dirname(PROGRESS_LOG), { recursive: true });
fs.writeFileSync(PROGRESS_LOG, '');

function logProgress(message) {
  console.log(message);
  fs.appendFileSync(PROGRESS_LOG, `${message}\n`);
}

const SUPPORTED_BENCHMARK_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.json', '.yml', '.yaml']);
const TARGET_RELATIVE_PATHS = [
  'ext-large-md-with-latex/example_matrices_align.md',
  'ext-large-md-with-latex/example_tables_with_math.md',
  'ext-large-md-with-latex/example_long_lines_with_math.md',
  'ext-large-md-with-latex/example_block_math.md',
  'ext-large-md-no-latex/example.md',
  'ext_valid_5mb_json_yaml_examples/package-lock-style-large.json',
  'ext_valid_5mb_json_yaml_examples/workspace-index-large.json',
  'ext_valid_5mb_json_yaml_examples/kubernetes-configmaps-large.yaml',
  'ext_valid_5mb_json_yaml_examples/.github/workflows/large-matrix.yml',
  'ext_broken_5mb_json_yaml_examples/broken-large-missing-end.json',
  'ext_broken_5mb_json_yaml_examples/broken-one-line-ish.json',
  'ext_broken_5mb_json_yaml_examples/broken-large-indent.yml',
  'ext_broken_5mb_json_yaml_examples/broken-anchors.yaml',
];
const SEED_RELATIVE_PATH = '_profile_seed.md';

const workspace = {
  id: 'ws-bench',
  name: 'Benchmark Files',
  path: WORKSPACE_PATH,
  detectedIcon: 'markdown',
};

function toFileId(relativePath) {
  return `${workspace.id}-${relativePath.replace(/\\/g, '/')}`;
}

function getExtension(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  return ext || '.txt';
}

function getFileType(relativePath) {
  const ext = getExtension(relativePath);
  if (ext === '.md' || ext === '.markdown') return 'Markdown';
  if (ext === '.json') return 'JSON';
  if (ext === '.yml' || ext === '.yaml') return 'YAML';
  if (ext === '.txt') return 'Text';
  return 'Other';
}

function getFile(relativePath) {
  const absolutePath = path.join(WORKSPACE_PATH, relativePath);
  const stat = fs.statSync(absolutePath);
  return {
    id: toFileId(relativePath),
    workspaceId: workspace.id,
    name: path.basename(relativePath),
    extension: getExtension(relativePath),
    workspace: workspace.name,
    absolutePath,
    relativePath,
    modifiedAt: stat.mtime.toISOString(),
    size: stat.size,
    isFavorite: false,
    isPinned: false,
    hasTodos: false,
  };
}

const seedFile = {
  id: toFileId(SEED_RELATIVE_PATH),
  workspaceId: workspace.id,
  name: SEED_RELATIVE_PATH,
  extension: '.md',
  workspace: workspace.name,
  absolutePath: path.join(WORKSPACE_PATH, SEED_RELATIVE_PATH),
  relativePath: SEED_RELATIVE_PATH,
  modifiedAt: new Date(Date.now() + 60000).toISOString(),
  size: 64,
  isFavorite: false,
  isPinned: false,
  hasTodos: false,
};
const existingTargetRelativePaths = TARGET_RELATIVE_PATHS.filter((relativePath) => {
  const absolutePath = path.join(WORKSPACE_PATH, relativePath);
  return fs.existsSync(absolutePath) && SUPPORTED_BENCHMARK_EXTENSIONS.has(getExtension(relativePath));
});
const files = [seedFile, ...existingTargetRelativePaths.map(getFile)];
const targetIds = existingTargetRelativePaths.map(toFileId);
const targetMetaById = new Map(existingTargetRelativePaths.map((relativePath) => [
  toFileId(relativePath),
  {
    relativePath,
    type: getFileType(relativePath),
    size: fs.statSync(path.join(WORKSPACE_PATH, relativePath)).size,
  },
]));

function isPortOpen(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await isPortOpen(APP_URL)) return null;

  const npmCmd = process.platform === 'win32' ? 'npm' : 'npm';
  const child = spawn(npmCmd, ['run', 'dev', '--', '--host', '127.0.0.1'], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await isPortOpen(APP_URL)) return child;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  child.kill();
  throw new Error(`Timed out waiting for ${APP_URL}`);
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function summarize(values) {
  if (values.length === 0) {
    return { count: 0, min: 0, median: 0, p95: 0, max: 0, mean: 0 };
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    min: Math.min(...values),
    median: percentile(values, 50),
    p95: percentile(values, 95),
    max: Math.max(...values),
    mean: sum / values.length,
  };
}

function printSummary(label, summary) {
  logProgress(
    `${label}: count=${summary.count} min=${summary.min.toFixed(2)}ms median=${summary.median.toFixed(2)}ms p95=${summary.p95.toFixed(2)}ms max=${summary.max.toFixed(2)}ms mean=${summary.mean.toFixed(2)}ms`,
  );
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  const consoleLines = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('[NavigationPerf]') || text.includes('[Profile]')) {
      consoleLines.push(`[${message.type()}] ${text}`);
    }
  });
  page.on('pageerror', (error) => {
    console.error('[pageerror]', error.message);
  });

  await page.exposeFunction('__extProfileInvoke', async (cmd, args = {}) => {
    if (cmd === 'initialize_example_workspace') return '';
    if (cmd === 'scan_directory') {
      return { files, detectedIcon: 'markdown' };
    }
    if (cmd === 'read_file') {
      if (args.relativePath === SEED_RELATIVE_PATH) {
        return '# Profile seed\n\nSmall file used to avoid cold-opening a 5 MB preview.';
      }
      return fs.readFileSync(path.join(WORKSPACE_PATH, args.relativePath), 'utf8');
    }
    if (cmd === 'get_file_modified_time') {
      if (args.relativePath === SEED_RELATIVE_PATH) return seedFile.modifiedAt;
      return fs.statSync(path.join(WORKSPACE_PATH, args.relativePath)).mtime.toISOString();
    }
    if (cmd === 'save_file') {
      return new Date().toISOString();
    }
    if (cmd === 'plugin:event|listen') return Math.floor(Math.random() * 1000000);
    if (cmd === 'plugin:event|unlisten') return null;
    if (cmd === 'plugin:dialog|ask') return true;
    if (cmd === 'plugin:opener|open_path') return null;
    return null;
  });

  await page.addInitScript(({ workspaceData }) => {
    localStorage.setItem('ext_workspaces', JSON.stringify([workspaceData]));
    localStorage.setItem('ext_favorites', JSON.stringify([]));
    localStorage.setItem('ext_sortMode', 'name-asc');
    localStorage.setItem('ext_customOrder', JSON.stringify({}));
    localStorage.setItem('ext_appearance', JSON.stringify({
      animations: false,
      premiumEffects: false,
      smoothTabs: false,
      sidebarHover: false,
      editorFocus: false,
      previewTransitions: false,
      reduceMotion: true,
      enableProfiler: true,
      previewCentered: false,
    }));

    const callbacks = {};
    let nextCallbackId = 1;
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener() {},
    };
    window.__TAURI_INTERNALS__ = {
      callbacks,
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main' },
      },
      transformCallback(callback, once = false) {
        const id = nextCallbackId++;
        callbacks[id] = { callback, once };
        return id;
      },
      unregisterCallback(id) {
        delete callbacks[id];
      },
      runCallback(id, payload) {
        const entry = callbacks[id];
        if (!entry) return;
        entry.callback(payload);
        if (entry.once) delete callbacks[id];
      },
      invoke(cmd, args, options) {
        return window.__extProfileInvoke(cmd, args, options);
      },
      convertFileSrc(filePath) {
        return filePath;
      },
    };
  }, { workspaceData: workspace });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.file-list-item', { timeout: 30000 });
  await page.getByText(workspace.name, { exact: true }).first().click();
  await page.waitForTimeout(100);

  if (VIEW_MODE === 'editor') {
    await page.getByRole('button', { name: /^Editor$/ }).first().click();
  } else if (VIEW_MODE === 'preview') {
    await page.getByRole('button', { name: /^Preview$/ }).first().click();
  }

  logProgress(`Opening ${targetIds.length} benchmark files in ${VIEW_MODE} mode...`);
  const openTimings = [];
  for (const [index, fileId] of targetIds.entries()) {
    const meta = targetMetaById.get(fileId);
    const openStart = performance.now();
    logProgress(`Opening ${index + 1}/${targetIds.length}: ${meta?.type || 'Unknown'} ${meta?.relativePath || fileId}`);
    const opened = await page.evaluate((id) => {
      const item = document.getElementById(`file-item-${id}`);
      item?.scrollIntoView({ block: 'center' });
      item?.click();
      return Boolean(item);
    }, fileId);

    if (!opened) throw new Error(`Could not find file list item for ${fileId}`);

    await page.waitForFunction((id) => {
      const tab = document.getElementById(`editor-tab-${id}`);
      const active = tab?.classList.contains('active');
      const loading = document.body.textContent?.includes('Loading massive file...');
      const editorReady = document.querySelector('.cm-content') || document.querySelector('.markdown-preview');
      return Boolean(tab && active && !loading && editorReady);
    }, fileId, { timeout: 12000 });
    const openMs = performance.now() - openStart;
    openTimings.push(openMs);
    logProgress(`Opened ${index + 1}/${targetIds.length}: ${meta?.type || 'Unknown'} ${meta?.relativePath || fileId} (${openMs.toFixed(2)}ms)`);
    await page.waitForTimeout(350);
  }

  if (SETTLE_AFTER_OPEN_MS > 0) {
    logProgress(`Settling for ${SETTLE_AFTER_OPEN_MS}ms before measured switches...`);
    await page.waitForTimeout(SETTLE_AFTER_OPEN_MS);
  }

  await page.evaluate(() => {
    window.__extNavProfileData = {
      longTasks: [],
      maxFrameDelay: 0,
      frameDelays: [],
      stale: { discarded: 0, cancelled: 0 },
    };

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__extNavProfileData.longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
      window.__extNavProfileLongTaskObserver = observer;
    } catch {}

    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const delta = now - last;
      if (delta > window.__extNavProfileData.maxFrameDelay) {
        window.__extNavProfileData.maxFrameDelay = delta;
      }
      if (delta > 20) {
        window.__extNavProfileData.frameDelays.push({ delta, at: now });
      }
      last = now;
      window.__extNavProfileRaf = requestAnimationFrame(loop);
    };
    window.__extNavProfileRaf = requestAnimationFrame(loop);
  });

  const switches = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const fileId = targetIds[i % targetIds.length];
    const result = await page.evaluate(async (id) => {
      const tab = document.getElementById(`editor-tab-${id}`);
      if (!tab) return { clicked: false, delay: 0, activePaint: 0, editorUsable: 0 };

      const start = performance.now();
      tab.click();

      await new Promise((resolve) => requestAnimationFrame(resolve));
      const activePaint = performance.now() - start;

      await new Promise((resolve) => requestAnimationFrame(resolve));
      const editorUsable = performance.now() - start;

      return {
        clicked: true,
        delay: editorUsable,
        activePaint,
        editorUsable,
        activeTabText: document.querySelector('.editor-tab.active')?.textContent || '',
      };
    }, fileId);

    if (!result.clicked) throw new Error(`Could not click tab ${fileId}`);
    switches.push({ fileId, ...result });
    await page.waitForTimeout(SWITCH_DELAY_MS);
  }

  const profileData = await page.evaluate(() => {
    if (window.__extNavProfileRaf) cancelAnimationFrame(window.__extNavProfileRaf);
    window.__extNavProfileLongTaskObserver?.disconnect();
    return window.__extNavProfileData;
  });
  const heapUsage = await page.evaluate(() => {
    const memory = performance.memory;
    if (!memory) return null;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  });

  const delays = switches.map((item) => item.delay);
  const activePaint = switches.map((item) => item.activePaint);
  const editorUsable = switches.map((item) => item.editorUsable);
  const over50 = delays.filter((value) => value > 50).length;
  const over200 = delays.filter((value) => value > 200).length;
  const worstLongTask = profileData.longTasks.reduce((max, item) => Math.max(max, item.duration), 0);

  logProgress('\n=== NAVIGATION PROFILE ===');
  switches.slice(0, 20).forEach((item, index) => {
    logProgress(`Switch ${index + 1} to ${item.fileId.slice(0, 18)}: ${item.delay.toFixed(2)}ms`);
  });

  logProgress(`\n--- Summary (${switches.length} switches, ${VIEW_MODE} mode) ---`);
  printSummary('Open/load time', summarize(openTimings));
  printSummary('Switch delay', summarize(delays));
  printSummary('Active paint', summarize(activePaint));
  printSummary('Editor usable', summarize(editorUsable));
  logProgress(`Max switch delay: ${Math.max(...delays).toFixed(2)}ms`);
  logProgress(`Max frame delay: ${profileData.maxFrameDelay.toFixed(2)}ms`);
  logProgress(`Switches > 50ms: ${over50}/${switches.length}`);
  logProgress(`Switches > 200ms: ${over200}/${switches.length}`);
  logProgress(`Long tasks (>50ms): ${profileData.longTasks.length}`);
  logProgress(`Worst long task: ${worstLongTask.toFixed(2)}ms`);
  logProgress(`Frame gaps >20ms: ${profileData.frameDelays.length}`);
  logProgress('\n--- Benchmark file types ---');
  for (const [fileId, meta] of targetMetaById.entries()) {
    logProgress(`${meta.type}: ${meta.relativePath} (${formatMb(meta.size)}) id=${fileId.slice(0, 24)}`);
  }
  if (heapUsage) {
    logProgress(
      `JS heap: used=${formatMb(heapUsage.usedJSHeapSize)} total=${formatMb(heapUsage.totalJSHeapSize)} limit=${formatMb(heapUsage.jsHeapSizeLimit)}`,
    );
  }

  const navPerfLines = consoleLines.filter((line) => line.includes('[NavigationPerf]'));
  if (navPerfLines.length > 0) {
    logProgress('\n--- NavigationPerf console lines ---');
    navPerfLines.slice(-80).forEach((line) => logProgress(line));
  }

  const reactProfileLines = consoleLines.filter((line) => line.includes('[Profile]'));
  if (reactProfileLines.length > 0) {
    logProgress('\n--- React Profile console lines ---');
    reactProfileLines.slice(-80).forEach((line) => logProgress(line));
  }

  if (RUN_MANUAL_SMOKE) {
    logProgress('\n--- Manual smoke ---');
    const smoke = await runManualSmoke(page, targetIds);
    for (const [key, value] of Object.entries(smoke)) {
      logProgress(`${key}: ${value}`);
    }
  }

  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (server) server.kill();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function runManualSmoke(page, ids) {
  const result = {};

  await page.evaluate((id) => {
    document.getElementById(`editor-tab-${id}`)?.click();
  }, ids[0]);
  await page.waitForTimeout(100);

  const focused = await page.evaluate(() => {
    const editor = Array.from(document.querySelectorAll('.cm-content'))
      .find((el) => el instanceof HTMLElement && el.offsetParent !== null);
    if (!(editor instanceof HTMLElement)) return false;
    editor.focus();
    return document.activeElement === editor || editor.contains(document.activeElement);
  });
  result.editorFocus = focused;

  const marker = ` nav-check-${Date.now()} `;
  await page.keyboard.type(marker);
  await page.waitForTimeout(400);
  result.typingVisible = await page.evaluate((text) => {
    const editor = Array.from(document.querySelectorAll('.cm-content'))
      .find((el) => el instanceof HTMLElement && el.offsetParent !== null);
    return Boolean(editor?.textContent?.includes(text.trim()));
  }, marker);

  result.scrollMoved = await page.evaluate(() => {
    const scroller = Array.from(document.querySelectorAll('.cm-scroller'))
      .find((el) => el instanceof HTMLElement && el.offsetParent !== null);
    if (!(scroller instanceof HTMLElement)) return false;
    const before = scroller.scrollTop;
    scroller.scrollTop = before + 1200;
    return scroller.scrollTop > before;
  });

  await page.evaluate(() => {
    const previewButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Preview'));
    previewButton?.click();
  });
  await page.evaluate((id) => {
    document.getElementById(`editor-tab-${id}`)?.click();
  }, ids[1]);
  await page.waitForTimeout(100);
  result.previewSwitchLastClickWins = await page.evaluate((id) => {
    return document.getElementById(`editor-tab-${id}`)?.classList.contains('active') === true;
  }, ids[1]);

  await page.evaluate(() => {
    document.querySelector('.editor-tab.active .editor-tab-close')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
  });
  await page.waitForTimeout(100);
  result.closeTabKeptActive = await page.evaluate(() => Boolean(document.querySelector('.editor-tab.active')));

  await page.evaluate((id) => {
    document.getElementById(`file-item-${id}`)?.click();
  }, ids[1]);
  await page.waitForTimeout(250);
  result.reopenWorks = await page.evaluate((id) => {
    return document.getElementById(`editor-tab-${id}`)?.classList.contains('active') === true;
  }, ids[1]);

  result.noWrongPreviewFlash = await page.evaluate(() => {
    const activeTabName = document.querySelector('.editor-tab.active .editor-tab-name')?.textContent;
    const statusName = document.querySelector('.editor-statusbar-accent')?.textContent;
    return Boolean(activeTabName && statusName && activeTabName === statusName);
  });

  return result;
}
