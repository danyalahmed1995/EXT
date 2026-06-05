import React from 'react';
import './SettingsModal.css';

interface SettingsModalProps {
  onClose: () => void;
  onRemoveAllWorkspaces: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onRemoveAllWorkspaces }) => {
  const ignoredDirs = [
    ".git", "node_modules", "dist", "build", "target", ".next", "out", "coverage", "vendor",
    "Library", "Temp", "tmp", ".cache", ".turbo", ".venv", "venv", "bin", "obj"
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        
        <div className="modal-body">
          <section className="settings-section">
            <h3>Theme</h3>
            <p className="settings-desc">EXT uses the system dark theme by default with a custom glassmorphism aesthetic.</p>
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
