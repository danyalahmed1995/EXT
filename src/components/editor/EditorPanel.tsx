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
} from '../../icons/icons';
import { MarkdownPreview } from '../preview/MarkdownPreview';
import { ThemeDropdown } from '../theme/ThemeDropdown';
import './EditorPanel.css';

// ── Types ────────────────────────────────────────────

export type ViewMode = 'editor' | 'split' | 'preview';

export interface EditorTab {
  id: string;
  name: string;
  extension: string;
  content: string;
  isDirty: boolean;
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
  onNewFile: () => void;
  onOpenSettings: () => void;
}

// ── Tab Icon Helper ─────────────────────────────────

function getTabIcon(extension: string): React.ReactNode {
  if (extension === '.md' || extension === '.markdown') {
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
      className={`editor-tab ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(tab.id)}
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

// ── EditorPanel Component ───────────────────────────

export const EditorPanel: React.FC<EditorPanelProps> = ({
  tabs,
  activeTabId,
  viewMode,
  onViewModeChange,
  onTabSelect,
  onTabClose,
  onContentChange,
  onSaveFile,
  onNewFile,
  onOpenSettings,
}) => {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (activeTabId) onSaveFile(activeTabId);
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

  const lineCount = activeTab.content.split('\n').length;
  const charCount = activeTab.content.length;
  const isMarkdown = activeTab.extension === '.md' || activeTab.extension === '.markdown';

  return (
    <div className="editor-panel" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Tab Bar with integrated view switcher */}
      <div className="editor-tab-bar">
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
      <div className="editor-content" onContextMenu={handleContextMenu}>
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className={`editor-content-editor ${viewMode === 'editor' ? 'full' : ''}`}>
            <CodeMirrorEditor
              key={activeTab.id}
              content={activeTab.content}
              onChange={(newContent) => onContentChange(activeTab.id, newContent)}
              onSave={() => onSaveFile(activeTab.id)}
            />
          </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && isMarkdown && (
          <div className={`editor-content-preview ${viewMode === 'preview' ? 'full' : ''}`}>
            <MarkdownPreview content={activeTab.content} />
          </div>
        )}

        {viewMode === 'preview' && !isMarkdown && (
          <div className="editor-content-editor full">
            <CodeMirrorEditor
              key={activeTab.id}
              content={activeTab.content}
              onChange={(newContent) => onContentChange(activeTab.id, newContent)}
              onSave={() => onSaveFile(activeTab.id)}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="editor-statusbar">
        <span className="editor-statusbar-item">
          <span className="editor-statusbar-accent">{activeTab.name}</span>
        </span>
        <span className="editor-statusbar-item">{lineCount} lines</span>
        <span className="editor-statusbar-item">{charCount} chars</span>
        <div className="editor-statusbar-spacer" />
        <span className="editor-statusbar-item">
          {activeTab.extension.replace('.', '').toUpperCase()}
        </span>
        <span className="editor-statusbar-item">UTF-8</span>
      </div>
    </div>
  );
};
