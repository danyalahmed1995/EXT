const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_URL = process.env.EXT_RESET_URL || 'http://127.0.0.1:1420';

const EXT_STORAGE_KEYS = [
  'ext_workspaces',
  'ext_favorites',
  'ext_sortMode',
  'ext_customOrder',
  'ext_appearance',
  'ext_active_theme_id',
  'ext_custom_themes',
];

const FRESH_STATE = {
  ext_workspaces: [],
  ext_favorites: [],
  ext_sortMode: 'date-desc',
  ext_customOrder: {},
  ext_appearance: {
    animations: true,
    premiumEffects: true,
    smoothTabs: true,
    sidebarHover: true,
    editorFocus: true,
    previewTransitions: true,
    reduceMotion: false,
    ignoredDirs: [
      '.git',
      'node_modules',
      'dist',
      'build',
      'target',
      '.next',
      'out',
      'coverage',
      'vendor',
      'Library',
      'Temp',
      'tmp',
      '.cache',
      '.turbo',
      '.venv',
      'venv',
      'bin',
      'obj',
    ],
    enableProfiler: false,
    previewCentered: false,
  },
};

function parseArgs(argv) {
  const options = {
    browser: true,
    desktop: false,
    dryRun: false,
    verify: true,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--desktop') options.desktop = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-browser') options.browser = false;
    else if (arg === '--no-verify') options.verify = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`EXT state reset

Usage:
  npm run reset:state
  npm run reset:state -- --desktop
  npm run reset:state -- --desktop --no-browser
  npm run reset:state -- --desktop --no-browser --dry-run

What it clears:
  - EXT localStorage keys for workspaces, favorites, sort/order, appearance, and themes.
  - With --desktop, Tauri/WebView2 storage for the EXT desktop app.

Environment:
  EXT_RESET_URL=http://127.0.0.1:1420  Override the dev app URL.
`);
}

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

  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
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

async function clearBrowserOrigin() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.log('Playwright is not installed; skipping browser-origin reset.');
    return { skipped: true };
  }

  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.addInitScript(({ keys, freshState }) => {
      for (const key of keys) localStorage.removeItem(key);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('ext_')) localStorage.removeItem(key);
      }
      for (const [key, value] of Object.entries(freshState)) {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
      sessionStorage.clear();
    }, { keys: EXT_STORAGE_KEYS, freshState: FRESH_STATE });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ keys, freshState }) => {
      for (const key of keys) localStorage.removeItem(key);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('ext_')) localStorage.removeItem(key);
      }
      for (const [key, value] of Object.entries(freshState)) {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
      sessionStorage.clear();
    }, { keys: EXT_STORAGE_KEYS, freshState: FRESH_STATE });

    const state = await page.evaluate(() => {
      return {
        workspaces: JSON.parse(localStorage.getItem('ext_workspaces') || '[]'),
        favorites: JSON.parse(localStorage.getItem('ext_favorites') || '[]'),
        sortMode: localStorage.getItem('ext_sortMode'),
        customOrder: JSON.parse(localStorage.getItem('ext_customOrder') || '{}'),
        customThemes: JSON.parse(localStorage.getItem('ext_custom_themes') || '[]'),
      };
    });

    return { state };
  } finally {
    await browser.close().catch(() => {});
    if (server) server.kill();
  }
}

function getDesktopStorageCandidates() {
  const candidates = [];

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      candidates.push(path.join(localAppData, 'com.danyalahmed.ext', 'EBWebView'));
      candidates.push(path.join(localAppData, 'com.ext.app', 'EBWebView'));
    }
  } else if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', 'com.danyalahmed.ext'));
    candidates.push(path.join(os.homedir(), 'Library', 'WebKit', 'com.danyalahmed.ext'));
  } else {
    const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    candidates.push(path.join(dataHome, 'com.danyalahmed.ext'));
    candidates.push(path.join(configHome, 'com.danyalahmed.ext'));
  }

  return candidates;
}

function isSafeDesktopStoragePath(targetPath) {
  const normalized = path.resolve(targetPath);
  const home = path.resolve(os.homedir());
  if (!normalized.startsWith(home)) return false;

  const normalizedLower = normalized.toLowerCase();
  return (
    normalizedLower.includes(`${path.sep}com.danyalahmed.ext${path.sep}`) ||
    normalizedLower.endsWith(`${path.sep}com.danyalahmed.ext`) ||
    normalizedLower.includes(`${path.sep}com.ext.app${path.sep}`) ||
    normalizedLower.endsWith(`${path.sep}com.ext.app`)
  );
}

function clearDesktopStorage({ dryRun = false } = {}) {
  const results = [];

  for (const candidate of getDesktopStorageCandidates()) {
    if (!isSafeDesktopStoragePath(candidate)) {
      results.push({ path: candidate, status: 'skipped-unsafe' });
      continue;
    }

    if (!fs.existsSync(candidate)) {
      results.push({ path: candidate, status: 'missing' });
      continue;
    }

    if (dryRun) {
      results.push({ path: candidate, status: 'would-remove' });
      continue;
    }

    try {
      fs.rmSync(candidate, { recursive: true, force: true });
      results.push({ path: candidate, status: 'removed' });
    } catch (error) {
      results.push({ path: candidate, status: 'failed', error: error.message });
    }
  }

  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  console.log('--- EXT Fresh State Reset ---');

  if (options.browser) {
    console.log(`Clearing browser/dev EXT localStorage at ${APP_URL}...`);
    const result = await clearBrowserOrigin();
    if (result.skipped) {
      console.log('Browser/dev reset skipped.');
    } else if (
      result.state.workspaces.length === 0 &&
      result.state.favorites.length === 0 &&
      result.state.sortMode === 'date-desc' &&
      Object.keys(result.state.customOrder).length === 0 &&
      result.state.customThemes.length === 0
    ) {
      console.log('Browser/dev reset: PASS');
    } else {
      throw new Error(`Browser/dev reset did not produce fresh state: ${JSON.stringify(result.state)}`);
    }
  }

  if (options.desktop) {
    console.log(`${options.dryRun ? 'Checking' : 'Clearing'} desktop EXT WebView storage...`);
    const results = clearDesktopStorage({ dryRun: options.dryRun });
    for (const item of results) {
      const suffix = item.error ? ` (${item.error})` : '';
      console.log(`  ${item.status}: ${item.path}${suffix}`);
    }

    const failed = results.filter((item) => item.status === 'failed');
    if (failed.length > 0) {
      throw new Error('Desktop reset failed. Close EXT and run the command again.');
    }
  }

  console.log('EXT will start with no saved workspaces/settings on the cleared target.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
