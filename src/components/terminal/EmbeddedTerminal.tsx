import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTheme } from '../../theme/ThemeContext';
import '@xterm/xterm/css/xterm.css';
import './EmbeddedTerminal.css';

interface EmbeddedTerminalProps {
  initialCwd: string;
  currentCwd: string;
  autoSyncCwd?: boolean;
  isVisible?: boolean;
  onClose: () => void;
  height: number;
}

interface TerminalSpawnResult {
  success: boolean;
  shell: string;
  error?: string;
}

export const EmbeddedTerminal: React.FC<EmbeddedTerminalProps> = ({
  initialCwd,
  currentCwd,
  autoSyncCwd = false,
  isVisible = true,
  onClose,
  height,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initialCwdRef = useRef(initialCwd); // Only capture first CWD to prevent unmounts
  const [shellName, setShellName] = useState<string>('Terminal');
  const [isSpawned, setIsSpawned] = useState(false);
  const { currentTheme } = useTheme();

  const getXtermTheme = useCallback(() => {
    const t = currentTheme.tokens;
    return {
      background: t['--color-editor'] || t['--color-bg'] || '#000000',
      foreground: t['--color-text-primary'] || '#ffffff',
      cursor: t['--color-accent'] || '#ffffff',
      cursorAccent: t['--color-bg'] || '#000000',
      selectionBackground: t['--color-selection'] || 'rgba(255, 255, 255, 0.3)',
      black: '#000000',
      red: t['--color-error'] || '#cc0000',
      green: t['--color-success'] || '#4e9a06',
      yellow: t['--color-warning'] || '#c4a000',
      blue: t['--color-info'] || '#3465a4',
      magenta: t['--color-syntax-keyword'] || '#75507b',
      cyan: t['--color-syntax-operator'] || '#06989a',
      white: t['--color-text-primary'] || '#d3d7cf',
      brightBlack: t['--color-text-muted'] || '#555753',
      brightRed: t['--color-syntax-invalid'] || '#ef2929',
      brightGreen: t['--color-syntax-string'] || '#8ae234',
      brightYellow: t['--color-syntax-type'] || '#fce94f',
      brightBlue: t['--color-syntax-function'] || '#729fcf',
      brightMagenta: t['--color-syntax-constant'] || '#ad7fa8',
      brightCyan: t['--color-syntax-operator'] || '#34e2e2',
      brightWhite: '#ffffff',
    };
  }, [currentTheme]);

  const spawnBackendTerminal = useCallback(async (cwdToSpawn: string) => {
    try {
      const result = await invoke<TerminalSpawnResult>('spawn_terminal', { cwd: cwdToSpawn });
      if (result.success) {
        setShellName(result.shell);
        setIsSpawned(true);
        setSyncedCwd(cwdToSpawn);
        lastSyncedCwdRef.current = cwdToSpawn;
      } else {
        xtermRef.current?.write(`\r\n\x1b[31mFailed to spawn terminal: ${result.error}\x1b[0m\r\n`);
      }
    } catch (err) {
      xtermRef.current?.write(`\r\n\x1b[31mError spawning terminal: ${String(err)}\x1b[0m\r\n`);
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: getXtermTheme(),
      fontFamily: '"JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.3,
      fontWeight: 'normal',
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      allowProposedApi: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn("WebGL addon failed to load, falling back to Canvas renderer", e);
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const onDataDisposable = term.onData((data) => {
      invoke('write_terminal', { data }).catch(console.error);
    });

    let unlistenOutput: (() => void) | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const setupTerminal = async () => {
      unlistenOutput = await listen<number[]>('terminal-output', (event) => {
        const uint8 = new Uint8Array(event.payload);
        term.write(uint8);
      });

    const handleResize = () => {
      if (terminalRef.current?.clientWidth === 0) return;
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          if (term.cols && term.rows) {
            invoke('resize_terminal', { rows: term.rows, cols: term.cols }).catch(console.error);
          }
        } catch (e) {
          // Ignore fit errors if container is hidden
        }
      });
    };

      await spawnBackendTerminal(initialCwdRef.current);

      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      // Wait a tick for layout to settle before observing
      setTimeout(() => {
        if (terminalRef.current && resizeObserver) {
          resizeObserver.observe(terminalRef.current);
          handleResize(); // Initial fit
        }
      }, 50);
    };

    setupTerminal();

    return () => {
      onDataDisposable.dispose();
      unlistenOutput?.();
      resizeObserver?.disconnect();
      term.dispose();
      invoke('kill_terminal').catch(console.error);
    };
  }, [spawnBackendTerminal]); // Only runs once now since spawnBackendTerminal has no deps

  // Update theme dynamically
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = getXtermTheme();
    }
  }, [getXtermTheme]);

  useEffect(() => {
    // Attempt to refit when height or visibility prop changes
    if (isVisible && fitAddonRef.current && xtermRef.current && terminalRef.current?.clientWidth !== 0) {
      requestAnimationFrame(() => {
        try {
          fitAddonRef.current!.fit();
          const term = xtermRef.current!;
          if (term.cols && term.rows) {
            invoke('resize_terminal', { rows: term.rows, cols: term.cols }).catch(console.error);
          }
        } catch (e) {
          // Ignore
        }
      });
    }
  }, [height, isVisible]);

  const [syncedCwd, setSyncedCwd] = useState<string>(initialCwdRef.current);

  const handleSyncCwd = useCallback(async (targetCwd: string) => {
    if (!targetCwd) return;
    const isWindows = shellName.toLowerCase().includes('pwsh') || shellName.toLowerCase().includes('powershell');
    
    // Safety: escape single quotes properly depending on shell
    let cmd = '';
    if (isWindows) {
      const escaped = `'${targetCwd.replace(/'/g, "''")}'`;
      cmd = `Set-Location -LiteralPath ${escaped}\r\n`;
    } else {
      const escaped = `'${targetCwd.replace(/'/g, "'\\''")}'`;
      cmd = `cd ${escaped}\n`;
    }
    
    await invoke('write_terminal', { data: cmd });
    setSyncedCwd(targetCwd);
  }, [shellName]);

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedCwdRef = useRef<string>(initialCwdRef.current);

  // Auto-sync CWD when active file changes
  useEffect(() => {
    if (autoSyncCwd && currentCwd && currentCwd !== lastSyncedCwdRef.current && isSpawned) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        if (currentCwd === lastSyncedCwdRef.current) return;
        lastSyncedCwdRef.current = currentCwd;
        handleSyncCwd(currentCwd);
      }, 300); // Debounce to prevent shell spam
    }
  }, [currentCwd, isSpawned, handleSyncCwd, autoSyncCwd]);

  const handleManualSync = () => {
    if (currentCwd) {
      handleSyncCwd(currentCwd);
      lastSyncedCwdRef.current = currentCwd;
    }
  };

  const handleClear = () => {
    xtermRef.current?.clear();
  };

  const handleRestart = async () => {
    setIsSpawned(false);
    xtermRef.current?.clear();
    await spawnBackendTerminal(currentCwd || initialCwdRef.current);
  };

  return (
    <div className="embedded-terminal-container" style={{ height, background: currentTheme.tokens['--color-editor'] || currentTheme.tokens['--color-bg'] }}>
      <div className="embedded-terminal-header" style={{ background: currentTheme.tokens['--color-surface-hover'] }}>
        <div className="terminal-title">
          Terminal <span>{isSpawned ? `(${shellName})` : ''}</span>
          {syncedCwd && <span className="terminal-cwd" title={syncedCwd}> - {syncedCwd}</span>}
          {currentCwd && syncedCwd !== currentCwd && (
            <span className="terminal-out-of-sync" title="Target CWD differs from Shell CWD. Click Sync CWD or enable Auto-sync to update." style={{ color: 'var(--color-warning)', marginLeft: '8px', fontSize: '10px' }}>
              ⚠️ Out of sync
            </span>
          )}
        </div>
        <div className="terminal-actions">
          <button className="icon-btn text-btn" onClick={handleManualSync} title={`Sync to: ${currentCwd || 'Workspace Root'}`}>
            Sync CWD
          </button>
          <button className="icon-btn text-btn" onClick={handleClear} title="Clear viewport (does not kill process)">
            Clear
          </button>
          <button className="icon-btn text-btn" onClick={handleRestart} title="Kill and Restart shell process">
            Restart
          </button>
          <button className="icon-btn" onClick={onClose} title="Hide terminal">
            ✕
          </button>
        </div>
      </div>
      <div className="embedded-terminal-body" ref={terminalRef} />
    </div>
  );
};
