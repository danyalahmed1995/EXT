import React from 'react';
import './SettingsModal.css';
import { AppearanceSettings } from '../../types';

interface SettingsModalProps {
  appearance: AppearanceSettings;
  onUpdateAppearance: (settings: AppearanceSettings) => void;
  onClose: () => void;
  onRemoveAllWorkspaces: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ appearance, onUpdateAppearance, onClose, onRemoveAllWorkspaces }) => {
  const ignoredDirs = [
    ".git", "node_modules", "dist", "build", "target", ".next", "out", "coverage", "vendor",
    "Library", "Temp", "tmp", ".cache", ".turbo", ".venv", "venv", "bin", "obj"
  ];

  const handleToggle = (key: keyof AppearanceSettings) => {
    onUpdateAppearance({
      ...appearance,
      [key]: !appearance[key]
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        
        <div className="modal-body">
          <section className="settings-section">
            <h3>Appearance & Performance</h3>
            <p className="settings-desc">Customize EXT's visual effects and animations.</p>
            
            <div className="settings-toggles">
              <label className="settings-toggle">
                <input type="checkbox" checked={appearance.animations} onChange={() => handleToggle('animations')} />
                <span className="toggle-label">Enable animations</span>
              </label>
              
              <label className="settings-toggle">
                <input type="checkbox" checked={appearance.premiumEffects} onChange={() => handleToggle('premiumEffects')} />
                <span className="toggle-label">Enable premium visual effects</span>
              </label>
              
              <label className="settings-toggle">
                <input type="checkbox" checked={appearance.smoothTabs} onChange={() => handleToggle('smoothTabs')} />
                <span className="toggle-label">Enable smooth tab transitions</span>
              </label>
              
              <label className="settings-toggle">
                <input type="checkbox" checked={appearance.sidebarHover} onChange={() => handleToggle('sidebarHover')} />
                <span className="toggle-label">Enable sidebar hover effects</span>
              </label>
              
              <label className="settings-toggle">
                <input type="checkbox" checked={appearance.editorFocus} onChange={() => handleToggle('editorFocus')} />
                <span className="toggle-label">Enable editor focus effects</span>
              </label>
              
              <label className="settings-toggle">
                <input type="checkbox" checked={appearance.previewTransitions} onChange={() => handleToggle('previewTransitions')} />
                <span className="toggle-label">Enable preview transition effects</span>
              </label>
              
              <label className="settings-toggle">
                <input type="checkbox" checked={appearance.reduceMotion} onChange={() => handleToggle('reduceMotion')} />
                <span className="toggle-label">Reduce motion mode</span>
              </label>

              <label className="settings-toggle">
                <input type="checkbox" checked={!!appearance.previewCentered} onChange={() => handleToggle('previewCentered')} />
                <span className="toggle-label">Center preview content (reading mode)</span>
              </label>

              <label className="settings-toggle" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)' }}>
                <input type="checkbox" checked={!!appearance.enableProfiler} onChange={() => handleToggle('enableProfiler')} />
                <span className="toggle-label">Enable Navigation Profiler (Debug)</span>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3>Ignored Directories</h3>
            <p className="settings-desc">The following directories are skipped during workspace scanning to improve performance:</p>
            <div className="ignored-dirs-list">
              {ignoredDirs.map(dir => (
                <span key={dir} className="ignored-dir-badge">{dir}</span>
              ))}
            </div>
          </section>

          <section className="settings-section danger-zone">
            <h3>Danger Zone</h3>
            <div className="danger-action">
              <div>
                <h4>Remove All Workspaces</h4>
                <p className="settings-desc">Removes all folders from EXT. Your local files will NOT be deleted from disk.</p>
              </div>
              <button className="btn btn-danger" onClick={() => {
                if (window.confirm('Are you sure you want to remove all workspaces from EXT?')) {
                  onRemoveAllWorkspaces();
                  onClose();
                }
              }}>
                Remove All
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
