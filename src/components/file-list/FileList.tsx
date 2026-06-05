import React, { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
  absolutePath: string;
  modifiedAt: string;
  isFavorite: boolean;
  size: number;
}

interface FileListProps {
  title: string;
  files: FileListFile[];
  activeFileId: string | null;
  sortMode: import('../../types').SortMode;
  onSortChange: (mode: import('../../types').SortMode) => void;
  onFileSelect: (fileId: string) => void;
  onToggleFavorite: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onCopyFile: (fileId: string) => void;
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
  absolutePath: string;
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `file-${id}`,
    data: { type: 'file', fileId: id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`file-list-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <span 
        className="file-list-item-icon"
      >
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
  sortMode,
  onSortChange,
  onFileSelect,
  onToggleFavorite,
  onDeleteFile,
  onCopyFile,
  onContextMenu,
}) => {
  const [showSortMenu, setShowSortMenu] = useState(false);

  const sortLabel = {
    'date-desc': 'Date (Newest)',
    'date-asc': 'Date (Oldest)',
    'name-asc': 'Name (A-Z)',
    'name-desc': 'Name (Z-A)',
    'custom': 'Custom',
  }[sortMode];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && activeFileId) {
      onCopyFile(activeFileId);
    }
  };

  return (
    <div className="file-list" onContextMenu={onContextMenu} tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="file-list-header">
        <div className="file-list-header-left">
          <span className="file-list-title">{title}</span>
          <span className="file-list-count">{files.length}</span>
        </div>
        <div className="file-list-sort-container">
          <button className="file-list-sort" onClick={() => setShowSortMenu(!showSortMenu)}>
            {sortLabel}
            <ChevronDownIcon size={12} />
          </button>
          {showSortMenu && (
            <div className="file-list-sort-menu">
              <div className="file-list-sort-item" onClick={() => { onSortChange('date-desc'); setShowSortMenu(false); }}>Date (Newest)</div>
              <div className="file-list-sort-item" onClick={() => { onSortChange('date-asc'); setShowSortMenu(false); }}>Date (Oldest)</div>
              <div className="file-list-sort-item" onClick={() => { onSortChange('name-asc'); setShowSortMenu(false); }}>Name (A-Z)</div>
              <div className="file-list-sort-item" onClick={() => { onSortChange('name-desc'); setShowSortMenu(false); }}>Name (Z-A)</div>
            </div>
          )}
        </div>
      </div>

      {/* File Items */}
      {files.length > 0 ? (
        <div className="file-list-items">
          <SortableContext items={files.map(f => `file-${f.id}`)} strategy={verticalListSortingStrategy}>
            {files.map((file) => (
              <FileListItem
                key={file.id}
                id={file.id}
                name={file.name}
                extension={file.extension}
                workspace={file.workspace}
                absolutePath={file.absolutePath}
                modifiedAt={file.modifiedAt}
                isFavorite={file.isFavorite}
                isActive={file.id === activeFileId}
                onSelect={() => onFileSelect(file.id)}
                onToggleFavorite={() => onToggleFavorite(file.id)}
                onDelete={() => onDeleteFile(file.id)}
              />
            ))}
          </SortableContext>
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
