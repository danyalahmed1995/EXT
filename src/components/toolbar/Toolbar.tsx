import React from 'react';
import {
  EditorIcon,
  SplitIcon,
  PreviewIcon,
  NewFileIcon,
  SettingsIcon,
} from '../../icons/icons';
import './Toolbar.css';

// ── Types ────────────────────────────────────────────

export type ViewMode = 'editor' | 'split' | 'preview';

interface ToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNewFile: () => void;
  onOpenSettings: () => void;
}

// ── Toolbar Component ───────────────────────────────

export const Toolbar: React.FC<ToolbarProps> = ({
  viewMode,
  onViewModeChange,
  onNewFile,
  onOpenSettings,
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">EXT</span>
      </div>

      <div className="toolbar-spacer" />

      {/* View Mode Switcher */}
      <div className="toolbar-view-switcher">
        <button
          className={`toolbar-view-btn ${viewMode === 'editor' ? 'active' : ''}`}
          onClick={() => onViewModeChange('editor')}
        >
          <EditorIcon size={13} />
          Editor
        </button>
        <button
          className={`toolbar-view-btn ${viewMode === 'split' ? 'active' : ''}`}
          onClick={() => onViewModeChange('split')}
        >
          <SplitIcon size={13} />
          Split
        </button>
        <button
          className={`toolbar-view-btn ${viewMode === 'preview' ? 'active' : ''}`}
          onClick={() => onViewModeChange('preview')}
        >
          <PreviewIcon size={13} />
          Preview
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Actions */}
      <div className="toolbar-actions">
        <button
          className="toolbar-action-btn"
          onClick={onNewFile}
          title="New File (Ctrl+N)"
        >
          <NewFileIcon size={16} />
        </button>
        <button
          className="toolbar-action-btn"
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
        >
          <SettingsIcon size={16} />
        </button>
      </div>
    </div>
  );
};
