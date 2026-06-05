import React, { useState, useRef, useEffect } from 'react';
import { FileMarkdownIcon } from '../../icons/icons';
import './Modal.css';

interface WorkspaceOption {
  id: string;
  name: string;
  path: string;
}

interface NewFileModalProps {
  workspaces: WorkspaceOption[];
  defaultWorkspaceId?: string;
  onClose: () => void;
  onCreate: (workspaceId: string, fileName: string) => void;
}

export const NewFileModal: React.FC<NewFileModalProps> = ({
  workspaces,
  defaultWorkspaceId,
  onClose,
  onCreate,
}) => {
  const [fileName, setFileName] = useState('new-file.md');
  const [workspaceId, setWorkspaceId] = useState(
    defaultWorkspaceId || (workspaces.length > 0 ? workspaces[0].id : '')
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Select the "new-file" part of the name
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(0, fileName.lastIndexOf('.'));
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fileName.trim() && workspaceId) {
      // Ensure extension is .md or .txt
      let finalName = fileName.trim();
      if (!finalName.endsWith('.md') && !finalName.endsWith('.markdown') && !finalName.endsWith('.txt')) {
        finalName += '.md';
      }
      onCreate(workspaceId, finalName);
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
          <FileMarkdownIcon size={20} />
          <h2 className="modal-title">New File</h2>
        </div>
        <p className="modal-description">
          Create a new Markdown or text file in your workspace.
        </p>

        <div className="modal-field">
          <label className="modal-label">File Name</label>
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            placeholder="e.g. notes.md"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Workspace</label>
          <select
            className="modal-input"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            disabled={workspaces.length === 0}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="modal-btn modal-btn-primary"
            disabled={!fileName.trim() || !workspaceId}
          >
            Create File
          </button>
        </div>
      </form>
    </div>
  );
};
