import React from 'react';
import { FileMarkdownIcon, FileTextIcon, StarIcon, StarFilledIcon } from '../../icons/icons';
import { isMarkdownFile } from '../../utils/fileTypes';

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
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = now.getFullYear();

  if (year === currentYear) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${year}`;
}

function getFileIcon(extension: string): React.ReactElement {
  return isMarkdownFile(extension)
    ? <FileMarkdownIcon className="file-item-icon" />
    : <FileTextIcon className="file-item-icon" />;
}

const FileListItem: React.FC<FileListItemProps> = ({
  name,
  extension,
  workspace,
  modifiedAt,
  isFavorite,
  isActive,
  onSelect,
  onToggleFavorite,
}) => {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite();
  };

  const classNames = ['file-list-item'];
  if (isActive) classNames.push('file-list-item-active');

  return (
    <div className={classNames.join(' ')} onClick={onSelect} role="button" tabIndex={0}>
      <div className="file-item-icon-wrapper">
        {getFileIcon(extension)}
      </div>

      <div className="file-item-details">
        <div className="file-item-top-row">
          <span className="file-item-name" title={name}>{name}</span>
          <span className="file-item-extension">
            {extension === '__shebang_shell' ? 'Shell Script' : extension}
          </span>
        </div>
        <span className="file-item-workspace" title={workspace}>{workspace}</span>
      </div>

      <div className="file-item-meta">
        <span className="file-item-date">{formatDate(modifiedAt)}</span>
        <button
          className={`file-item-favorite ${isFavorite ? 'file-item-favorite-active' : ''}`}
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? <StarFilledIcon /> : <StarIcon />}
        </button>
      </div>
    </div>
  );
};

export default FileListItem;
