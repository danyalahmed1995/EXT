import React, { useState, useRef, useEffect } from 'react';
import './Modal.css';

interface RenameModalProps {
  initialName: string;
  title: string;
  description: string;
  onClose: () => void;
  onSubmit: (newName: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  initialName,
  title,
  description,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Select the name part without extension if it's a file
      const lastDotIndex = name.lastIndexOf('.');
      if (lastDotIndex > 0) {
        inputRef.current.setSelectionRange(0, lastDotIndex);
      } else {
        inputRef.current.setSelectionRange(0, name.length);
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== initialName) {
      onSubmit(name.trim());
      onClose();
    } else {
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
          <h2 className="modal-title">{title}</h2>
        </div>
        <p className="modal-description">{description}</p>

        <div className="modal-field">
          <label className="modal-label">Name</label>
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
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
            disabled={!name.trim() || name.trim() === initialName}
          >
            Rename
          </button>
        </div>
      </form>
    </div>
  );
};
