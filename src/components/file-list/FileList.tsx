import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  FileMarkdownIcon,
  FileTextIcon,
  StarIcon,
  StarFilledIcon,
  FolderIcon,
  ChevronDownIcon,
  TrashIcon,
} from '../../icons/icons';
import './FileList.css';

// ── Types ────────────────────────────────────────────

interface FileListFile {
  id: string;
  name: string;
  extension: string;
  workspace: string;
  modifiedAt: string;
  isFavorite: boolean;
  size: number;
}

interface FileListProps {
  title: string;
  files: FileListFile[];
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onToggleFavorite: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onContextMenu?: (e: React.MouseEvent, fileId?: string) => void;
}

// ── Date Formatting ─────────────────────────────────

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── File Icon Helper ────────────────────────────────

function getFileIcon(extension: string): React.ReactNode {
  if (extension === '.md' || extension === '.markdown') {
    return <FileMarkdownIcon size={18} />;
  }
  return <FileTextIcon size={18} />;
}

// ── FileListItem Component ──────────────────────────

interface FileListItemProps {
  id: string;
  name: string;
  extension: string;
  workspace: string;
  modifiedAt: string;
  isFavorite: boolean;
  isActive: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

const FileListItem: React.FC<FileListItemProps> = ({
  id,
  name,
  extension,
  workspace,
  modifiedAt,
  isFavorite,
  isActive,
  onSelect,
  onToggleFavorite,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `file-${id}`,
    data: { type: 'file', fileId: id },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`file-list-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <span className="file-list-item-icon">
        {getFileIcon(extension)}
      </span>

      <div className="file-list-item-content">
        <span className="file-list-item-name">{name}</span>
        <div className="file-list-item-meta">
          <span className="file-list-item-workspace">{workspace}</span>
          <span className="file-list-item-ext">{extension}</span>
        </div>
      </div>

      <div className="file-list-item-right">
        <span className="file-list-item-date">{formatDate(modifiedAt)}</span>
        <button
          className={`file-list-item-favorite ${isFavorite ? 'is-favorite' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? <StarFilledIcon size={14} /> : <StarIcon size={14} />}
        </button>
        <button
          className="file-list-item-delete"
          style={{ color: '#f5546a', marginLeft: '4px' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete file"
        >
          <TrashIcon size={14} />
        </button>
      </div>
    </div>
  );
};

// ── FileList Component ──────────────────────────────

export const FileList: React.FC<FileListProps> = ({
  title,
  files,
  activeFileId,
  onFileSelect,
  onToggleFavorite,
  onDeleteFile,
  onContextMenu,
}) => {
  return (
    <div className="file-list" onContextMenu={onContextMenu}>
      {/* Header */}
      <div className="file-list-header">
        <div className="file-list-header-left">
          <span className="file-list-title">{title}</span>
          <span className="file-list-count">{files.length}</span>
        </div>
        <button className="file-list-sort">
          Modified
          <ChevronDownIcon size={12} />
        </button>
      </div>

      {/* File Items */}
      {files.length > 0 ? (
        <div className="file-list-items">
          {files.map((file) => (
            <FileListItem
              key={file.id}
              id={file.id}
              name={file.name}
              extension={file.extension}
              workspace={file.workspace}
              modifiedAt={file.modifiedAt}
              isFavorite={file.isFavorite}
              isActive={file.id === activeFileId}
              onSelect={() => onFileSelect(file.id)}
              onToggleFavorite={() => onToggleFavorite(file.id)}
              onDelete={() => onDeleteFile(file.id)}
            />
          ))}
        </div>
      ) : (
        <div className="file-list-empty">
          <FolderIcon size={32} className="file-list-empty-icon" />
          <span>No Markdown or text files found in this view.</span>
        </div>
      )}
    </div>
  );
};
