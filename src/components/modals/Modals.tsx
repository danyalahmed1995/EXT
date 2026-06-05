import React, { useState, useRef, useEffect } from 'react';
import { FolderIcon, SparkleIcon } from '../../icons/icons';
import './Modal.css';

// ── Add Folder Modal ────────────────────────────────

interface AddFolderModalProps {
  onClose: () => void;
  onAdd: (name: string, path: string) => void;
}

export const AddFolderModal: React.FC<AddFolderModalProps> = ({ onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && path.trim()) {
      onAdd(name.trim(), path.trim());
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <form className="modal" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <FolderIcon size={20} />
          <h2 className="modal-title">Add Folder</h2>
        </div>
        <p className="modal-description">
          Add a folder to scan for Markdown and text files. In the desktop app, this will use a native folder picker.
        </p>

        <div className="modal-field">
          <label className="modal-label">Workspace Name</label>
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder="e.g. my-notes"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Folder Path</label>
          <input
            type="text"
            className="modal-input"
            placeholder="e.g. D:/Documents/notes"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="modal-btn modal-btn-primary"
            disabled={!name.trim() || !path.trim()}
          >
            Add Folder
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Start from Scratch Modal ────────────────────────

interface StartFromScratchModalProps {
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const StartFromScratchModal: React.FC<StartFromScratchModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <form className="modal" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <SparkleIcon size={20} />
          <h2 className="modal-title">Start from Scratch</h2>
        </div>
        <p className="modal-description">
          Create a new workspace with a blank README.md. In the desktop app, this will create a real folder on disk.
        </p>

        <div className="modal-field">
          <label className="modal-label">Workspace Name</label>
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder="e.g. my-new-project"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="modal-btn modal-btn-primary"
            disabled={!name.trim()}
          >
            Create Workspace
          </button>
        </div>
      </form>
    </div>
  );
};
