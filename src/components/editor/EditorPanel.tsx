import React from 'react';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import {
  FileMarkdownIcon,
  FileTextIcon,
  CloseIcon,
  UnsavedDot,
  SparkleIcon,
  EditorIcon,
  SplitIcon,
  PreviewIcon,
  NewFileIcon,
  SettingsIcon,
  PrintIcon,
} from '../../icons/icons';
import { MarkdownPreview, printMarkdownDocument } from '../preview/MarkdownPreview';
import { ThemeDropdown } from '../theme/ThemeDropdown';
import type { ConvertibleLineEnding, LineEnding } from '../../utils/lineEndings';
import { getEditorLanguage, getFileTypeLabel, isMarkdownFile, isPreviewableMarkdownFile } from '../../utils/fileTypes';
import type { LargeFileMetadata, LargeFileSessionState } from '../../utils/largeFile';
import { formatBytes } from '../../utils/largeFile';
import { LargeFileModePanel } from './LargeFileModePanel';
import { useGitStatus } from '../../hooks/useGitStatus';
import './EditorPanel.css';

// ── Types ────────────────────────────────────────────

export const PRINT_MAX_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB limit for printing

export type ViewMode = 'editor' | 'split' | 'preview';
export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';
const MAX_HOT_EDITOR_VIEWS = 6;

export interface EditorTab {
  id: string;
  name: string;
  extension: string;
  content: string;
  isDirty?: boolean;
  saveStatus?: 'saving' | 'saved' | 'error' | 'unsaved';
  absolutePath: string;
  isLoading?: boolean;
  lineEnding?: LineEnding;
  isLargeFile?: boolean;
  workspacePath?: string;
  relativePath?: string;
  largeFileMetadata?: LargeFileMetadata;
  largeFileState?: LargeFileSessionState;
}

interface EditorPanelProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onContentChange: (tabId: string, content: string) => void;
  onSaveFile: (tabId: string) => void;
  onConvertLineEnding: (tabId: string, target: ConvertibleLineEnding) => void;
  onLargeFileStateChange?: (tabId: string, state: LargeFileSessionState, isDirty: boolean) => void;
  onNewFile: () => void;
  onOpenSettings: () => void;
  previewKey?: number;
  showLargeFileDetails?: boolean;
}

// ── Tab Icon Helper ─────────────────────────────────

function getTabIcon(extension: string): React.ReactNode {
  if (isMarkdownFile(extension)) {
    return <FileMarkdownIcon size={14} />;
  }
  return <FileTextIcon size={14} />;
}

// ── Sortable Tab Component ──────────────────────────

interface SortableTabProps {
  tab: EditorTab;
  isActive: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

const SortableTab: React.FC<SortableTabProps> = ({ tab, isActive, onSelect, onClose }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `tab-${tab.id}`,
    data: { type: 'tab', tabId: tab.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      id={`editor-tab-${tab.id}`}
      className={`editor-tab ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(tab.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const event = new CustomEvent('tab-bar-context-menu', {
          detail: { x: e.clientX, y: e.clientY, clickedTabId: tab.id, activeTabId: tab.id }
        });
        window.dispatchEvent(event);
      }}
    >
      <span className="editor-tab-icon">{getTabIcon(tab.extension)}</span>
      <span className="editor-tab-name">{tab.name}</span>
      {tab.isDirty && (
        <span className="editor-tab-unsaved">
          <UnsavedDot size={7} />
        </span>
      )}
      <button
        className="editor-tab-close"
        onPointerDown={(e) => e.stopPropagation()} // Prevent drag start on close button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        title="Close tab"
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
};


export const EditorPanel: React.FC<EditorPanelProps> = ({
  tabs,
  activeTabId,
  viewMode,
  onViewModeChange,
  onTabSelect,
  onTabClose,
  onContentChange,
  onSaveFile,
  onConvertLineEnding,
  onLargeFileStateChange,
  onNewFile,
  onOpenSettings,
  previewKey,
  showLargeFileDetails = true,
}) => {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isLargeFileTab = Boolean(activeTab?.isLargeFile);
  const [hotEditorTabIds, setHotEditorTabIds] = React.useState<string[]>(() => activeTabId ? [activeTabId] : []);
  const [showLineEndingMenu, setShowLineEndingMenu] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const gitStatus = useGitStatus(activeTab?.absolutePath, activeTab?.isDirty ?? false, activeTab?.saveStatus ?? 'saved');

  React.useEffect(() => {
    if (!activeTabId) return;
    setHotEditorTabIds((prev) => {
      const withoutActive = prev.filter((id) => id !== activeTabId && tabs.some((tab) => tab.id === id));
      return [...withoutActive.slice(-(MAX_HOT_EDITOR_VIEWS - 1)), activeTabId];
    });
  }, [activeTabId, tabs]);

  const hotEditorTabs = React.useMemo(
    () => hotEditorTabIds
      .map((id) => tabs.find((tab) => tab.id === id))
      .filter((tab): tab is EditorTab => Boolean(tab)),
    [hotEditorTabIds, tabs],
  );

  React.useEffect(() => {
    if (activeTabId) {
      const el = document.getElementById(`editor-tab-${activeTabId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId]);

  React.useEffect(() => {
    setShowLineEndingMenu(false);
  }, [activeTabId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (activeTabId) onSaveFile(activeTabId);
      return;
    }

    if (viewMode === 'preview') {
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        const previewEl = document.querySelector('.markdown-preview');
        if (previewEl) {
          e.preventDefault();
          const direction = e.key === 'PageDown' ? 1 : -1;
          const amount = previewEl.clientHeight * 0.8;
          previewEl.scrollBy({ top: direction * amount, behavior: 'smooth' });
        }
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Dispatch a custom event to App.tsx to show the save context menu
    const event = new CustomEvent('editor-context-menu', {
      detail: { x: e.clientX, y: e.clientY, tabId: activeTabId }
    });
    window.dispatchEvent(event);
  };

  const handleTabBarContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const event = new CustomEvent('tab-bar-context-menu', {
      detail: { x: e.clientX, y: e.clientY, clickedTabId: undefined, activeTabId }
    });
    window.dispatchEvent(event);
  };

  const [lineCount, setLineCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (activeTab?.isLargeFile) {
      setLineCount(null);
      return;
    }
    const content = activeTab?.content ?? '';
    if (!content) {
      setLineCount(0);
      return;
    }

    let cancelled = false;
    let index = 0;
    let count = 1;
    let maxChunkMs = 0;
    const startedAt = performance.now();

    const schedule = (callback: IdleRequestCallback) => {
      if ('requestIdleCallback' in window) {
        return window.requestIdleCallback(callback, { timeout: 500 });
      }
      return globalThis.setTimeout(() => {
        callback({ didTimeout: true, timeRemaining: () => 4 } as IdleDeadline);
      }, 16);
    };

    const cancel = (id: number) => {
      if ('cancelIdleCallback' in window) {
        window.cancelIdleCallback(id);
      } else {
        globalThis.clearTimeout(id);
      }
    };

    setLineCount(null);
    let scheduledId = 0;
    const processChunk: IdleRequestCallback = (_deadline) => {
      const chunkStart = performance.now();
      while (index < content.length && performance.now() - chunkStart < 4) {
        if (content.charCodeAt(index) === 10) count++;
        index++;
      }

      maxChunkMs = Math.max(maxChunkMs, performance.now() - chunkStart);
      if (cancelled) return;

      if (index >= content.length) {
        setLineCount(count);
        const totalMs = performance.now() - startedAt;
        if (totalMs > 16 || maxChunkMs > 8) {
          console.log(`[NavigationPerf] status line count: total=${totalMs.toFixed(1)}ms maxChunk=${maxChunkMs.toFixed(1)}ms`);
        }
      } else {
        scheduledId = schedule(processChunk);
      }
    };

    scheduledId = schedule(processChunk);
    return () => {
      cancelled = true;
      if (scheduledId) cancel(scheduledId);
    };
  }, [activeTab?.id, activeTab?.content, activeTab?.isLargeFile]);
  const charCount = activeTab?.isLargeFile ? activeTab.largeFileMetadata?.size ?? 0 : activeTab?.content ? activeTab.content.length : 0;
  const lineEndingLabel = activeTab?.lineEnding ?? 'LF';
  const activeTabLanguage = activeTab ? getEditorLanguage(activeTab.extension) : 'text';
  const activeTabPreviewable = activeTab && !activeTab.isLargeFile ? isPreviewableMarkdownFile(activeTab.extension) : false;

  if (!activeTab) {
    return (
      <div className="editor-panel">
        <div className="editor-tab-bar">
          <div className="editor-tabs" />
          <div className="editor-tab-bar-right">
            <div className="editor-view-switcher">
              <button
                className={`editor-view-btn ${viewMode === 'editor' ? 'active' : ''}`}
                onClick={() => onViewModeChange('editor')}
              >
                <EditorIcon size={13} />
                Editor
              </button>
              <button
                className={`editor-view-btn ${viewMode === 'split' ? 'active' : ''}`}
                onClick={() => onViewModeChange('split')}
              >
                <SplitIcon size={13} />
                Split
              </button>
              <button
                className={`editor-view-btn ${viewMode === 'preview' ? 'active' : ''}`}
                onClick={() => onViewModeChange('preview')}
              >
                <PreviewIcon size={13} />
                Preview
              </button>
            </div>
            <ThemeDropdown />
          </div>
        </div>
        <div className="editor-empty">
          <SparkleIcon size={48} className="editor-empty-icon" />
          <span>Select a file to start editing</span>
          <span className="editor-empty-hint">
            Choose a file from the list, or press Ctrl+N to create one
          </span>
        </div>
      </div>
    );
  }

  const onRender = (
    id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    _baseDuration: number,
    _startTime: number,
    commitTime: number
  ) => {
    if (actualDuration > 16) {
      console.warn(`[Profile] ${id} (${phase}) took ${actualDuration.toFixed(2)}ms (commit: ${commitTime})`);
    }
    if (actualDuration > 50) {
      console.error(`[Profile] SERIOUS ISSUE: ${id} (${phase}) took ${actualDuration.toFixed(2)}ms!`);
    }
    (window as any).__lastRenderTime = actualDuration;
  };


  const handlePrintPreview = async () => {
    if (!activeTab || isPrinting) return;
    try {
      setIsPrinting(true);
      await printMarkdownDocument(activeTab.content, activeTab.absolutePath);
    } catch (err) {
      console.error('Failed to print markdown preview:', err);
      alert('Failed to generate print preview. Document might be too complex.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <React.Profiler id="EditorPanel" onRender={onRender}>
      <div className="editor-panel" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Tab Bar with integrated view switcher */}
      <div className="editor-tab-bar" onContextMenu={handleTabBarContextMenu}>
        <div 
          className="editor-tabs"
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
        >
          <SortableContext items={tabs.map(t => `tab-${t.id}`)} strategy={horizontalListSortingStrategy}>
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSelect={onTabSelect}
                onClose={onTabClose}
              />
            ))}
          </SortableContext>
        </div>

        {/* View switcher + actions */}
        <div className="editor-tab-bar-right">
          <div className="editor-view-switcher">
            <button
              className={`editor-view-btn ${isLargeFileTab || viewMode === 'editor' ? 'active' : ''}`}
              onClick={() => onViewModeChange('editor')}
            >
              <EditorIcon size={13} />
              Editor
            </button>
            <button
              className={`editor-view-btn ${!isLargeFileTab && viewMode === 'split' ? 'active' : ''}`}
              onClick={() => onViewModeChange('split')}
              disabled={isLargeFileTab}
              title={isLargeFileTab ? 'Preview is disabled in Large File Mode' : 'Split'}
            >
              <SplitIcon size={13} />
              Split
            </button>
            <button
              className={`editor-view-btn ${!isLargeFileTab && viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => onViewModeChange('preview')}
              disabled={isLargeFileTab}
              title={isLargeFileTab ? 'Preview is disabled in Large File Mode' : 'Preview'}
            >
              <PreviewIcon size={13} />
              Preview
            </button>
          </div>
          {activeTabPreviewable && (viewMode === 'preview' || viewMode === 'split') && (() => {
            const isTooLargeToPrint = charCount > PRINT_MAX_SIZE_BYTES;
            return (
              <button
                className="editor-action-btn"
                onClick={isTooLargeToPrint ? undefined : handlePrintPreview}
                title={isTooLargeToPrint ? "Printing is disabled for very large files. Open in an external editor/browser to print." : isPrinting ? "Preparing Print..." : "Print Preview"}
                disabled={isPrinting || isTooLargeToPrint}
                style={{ opacity: isPrinting || isTooLargeToPrint ? 0.5 : 1, cursor: isTooLargeToPrint ? 'not-allowed' : isPrinting ? 'wait' : 'pointer' }}
                data-testid="print-button"
              >
                <PrintIcon size={16} />
              </button>
            );
          })()}
          <ThemeDropdown />
          <button
            className="editor-action-btn"
            onClick={onNewFile}
            title="New File (Ctrl+N)"
          >
            <NewFileIcon size={16} />
          </button>
          <button
            className="editor-action-btn"
            onClick={onOpenSettings}
            title="Settings (Ctrl+,)"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      {activeTab.isLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, color: 'var(--color-text-muted)' }}>
           <div className="spinner" style={{ width: 40, height: 40, border: '4px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
           <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
           <span>Loading massive file...</span>
        </div>
      ) : (
      <div className="editor-content" style={{ position: 'relative' }} onContextMenuCapture={handleContextMenu}>
        <div 
          className="editor-tab-content-wrapper active"
          style={{ flex: 1, width: '100%', height: '100%', display: 'flex' }}
        >
          {activeTab.isLargeFile && activeTab.largeFileMetadata ? (
            <div className="editor-content-editor full">
              <LargeFileModePanel
                tabId={activeTab.id}
                workspacePath={activeTab.workspacePath}
                relativePath={activeTab.relativePath}
                metadata={activeTab.largeFileMetadata}
                state={activeTab.largeFileState}
                showDetailsPanel={showLargeFileDetails}
                onStateChange={(state, isDirty) => onLargeFileStateChange?.(activeTab.id, state, isDirty)}
              />
            </div>
          ) : (viewMode === 'editor' || viewMode === 'split') && (
            <div className={`editor-content-editor ${viewMode === 'editor' ? 'full' : ''}`}>
              {hotEditorTabs.map((tab) => (
                <div
                  key={tab.id}
                  style={{
                    display: tab.id === activeTab.id ? 'block' : 'none',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <CodeMirrorEditor
                    activeTabId={tab.id}
                    content={tab.content}
                    onChange={onContentChange}
                    onSave={onSaveFile}
                    isActive={tab.id === activeTab.id}
                    language={getEditorLanguage(tab.extension)}
                  />
                </div>
              ))}
            </div>
          )}

          {(viewMode === 'preview' || viewMode === 'split') && activeTabPreviewable && (
            <div className={`editor-content-preview ${viewMode === 'preview' ? 'full' : ''}`}>
              <MarkdownPreview key={`${activeTab.id}-${previewKey}`} content={activeTab.content} absolutePath={activeTab.absolutePath} isActive={true} />
            </div>
          )}

          {!activeTab.isLargeFile && viewMode === 'preview' && !activeTabPreviewable && (
            <div className="editor-content-editor full">
              <CodeMirrorEditor
                activeTabId={activeTab.id}
                content={activeTab.content}
                onChange={onContentChange}
                onSave={onSaveFile}
                isActive={true}
                language={activeTabLanguage}
              />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Status Bar */}
      <div className="editor-statusbar">
        <span className="editor-statusbar-item">
          <span className="editor-statusbar-accent">{activeTab.name}</span>
        </span>
        <span className="editor-statusbar-item">{activeTab.isLargeFile ? 'Large File Mode' : `${lineCount == null ? '...' : lineCount} lines`}</span>
        <span className="editor-statusbar-item">{activeTab.isLargeFile ? formatBytes(charCount) : `${charCount} chars`}</span>
        <span className="editor-statusbar-item" style={{ color: activeTab.saveStatus === 'error' ? 'var(--color-error)' : activeTab.saveStatus === 'saving' ? 'var(--color-accent)' : activeTab.isDirty ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
          {activeTab.isLargeFile ? 'Read-only / limited' : activeTab.saveStatus === 'error' ? 'Save failed' : activeTab.saveStatus === 'saving' ? 'Saving...' : activeTab.isDirty ? 'Unsaved changes' : 'Saved'}
        </span>
        <div className="editor-statusbar-spacer" />
        {gitStatus && (
          <span className="editor-statusbar-item" title={gitStatus.is_dirty ? 'Uncommitted changes' : 'Clean'}>
            <svg style={{ width: '1em', height: '1em', marginRight: '4px', fill: 'currentColor', verticalAlign: '-0.125em' }} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
            </svg>
            {gitStatus.branch_name}{gitStatus.is_dirty ? '*' : ''}
          </span>
        )}
        <span className="editor-statusbar-item">
          {getFileTypeLabel(activeTab.extension)}
        </span>
        <span className="editor-statusbar-item">UTF-8</span>
        <div className="editor-statusbar-line-ending">
          <button
            className="editor-statusbar-button"
            onClick={() => setShowLineEndingMenu((open) => !open)}
            title="Change line endings"
            type="button"
          >
            {lineEndingLabel}
          </button>
          {showLineEndingMenu && (
            <div className="editor-statusbar-menu">
              <button
                type="button"
                className="editor-statusbar-menu-item"
                onClick={() => {
                  onConvertLineEnding(activeTab.id, 'LF');
                  setShowLineEndingMenu(false);
                }}
              >
                Convert to LF
              </button>
              <button
                type="button"
                className="editor-statusbar-menu-item"
                onClick={() => {
                  onConvertLineEnding(activeTab.id, 'CRLF');
                  setShowLineEndingMenu(false);
                }}
              >
                Convert to CRLF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </React.Profiler>
  );
};
