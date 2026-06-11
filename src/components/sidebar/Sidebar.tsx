import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SearchIcon,
  ClockIcon,
  StarIcon,
  FileMarkdownIcon,
  FileTextIcon,
  CalendarIcon,
  ChecklistIcon,
  PlusIcon,
  SettingsIcon,
  ChevronRightIcon,
  TypeScriptIcon,
  PythonIcon,
  RustIcon,
  PromptIcon,
  BugIcon,
  MarkdownIcon,
  FolderIcon,
} from '../../icons/icons';
import { MarkdownOutline } from './MarkdownOutline';
import { supportsOutline } from '../../utils/fileTypes';
import './Sidebar.css';

// ── Types ────────────────────────────────────────────

interface SidebarProps {
  workspaces: Array<{
    id: string;
    name: string;
    path: string;
    detectedIcon: string;
  }>;
  smartViewCounts: {
    recent: number;
    favorites: number;
    allMarkdown: number;
    allText: number;
    modifiedToday: number;
    todos: number;
  };
  activeView: string;
  onViewChange: (view: string) => void;
  onAddFolder: () => void;
  onOpenSettings: () => void;
  onSearch: (query: string, global: boolean) => void;
  onWorkspaceContextMenu?: (e: React.MouseEvent, workspaceId: string) => void;
  activeFileContent?: string;
  activeFileExtension?: string;
  activeFileId: string | null;
  selectedWorkspaces: Set<string>;
  onToggleWorkspaceSelection: (workspaceId: string) => void;
}

// ── Helper: Get workspace icon ──────────────────────

function getWorkspaceIcon(type: string): React.ReactNode {
  switch (type) {
    case 'typescript': return <TypeScriptIcon size={16} />;
    case 'python': return <PythonIcon size={16} />;
    case 'rust': return <RustIcon size={16} />;
    case 'prompt': return <PromptIcon size={16} />;
    case 'bug': return <BugIcon size={16} />;
    case 'markdown': return <MarkdownIcon size={16} />;
    default: return <FolderIcon size={16} />;
  }
}

// ── Collapsible Section ─────────────────────────────

interface SidebarSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  defaultExpanded = true,
  children,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="sidebar-section">
      <div
        className="sidebar-section-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`sidebar-section-chevron ${expanded ? 'expanded' : ''}`}>
          <ChevronRightIcon size={12} />
        </span>
        {title}
      </div>
      {expanded && (
        <div className="sidebar-section-children">
          {children}
        </div>
      )}
    </div>
  );
};

// ── Smart View Item ─────────────────────────────────

interface SmartViewItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  viewId: string;
  isActive: boolean;
  onClick: () => void;
}

const SmartViewItem: React.FC<SmartViewItemProps> = ({
  icon,
  label,
  count,
  isActive,
  onClick,
}) => (
  <div
    className={`sidebar-item ${isActive ? 'active' : ''}`}
    onClick={onClick}
  >
    <span className="sidebar-item-icon">{icon}</span>
    <span className="sidebar-item-label">{label}</span>
    <span className="sidebar-item-count">{count}</span>
  </div>
);

// ── Workspace Item ──────────────────────────────────

interface WorkspaceItemProps {
  id: string;
  name: string;
  detectedIcon: string;
  isActive: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isSelected: boolean;
  onToggleSelection: () => void;
}

const WorkspaceItem: React.FC<WorkspaceItemProps> = ({
  id,
  name,
  detectedIcon,
  isActive,
  onClick,
  onContextMenu,
  isSelected,
  onToggleSelection,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `workspace-${id}`,
    data: { type: 'workspace', workspaceId: id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`workspace-item ${isActive ? 'active' : ''} ${isOver ? 'drag-over' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div 
        className={`ext-checkbox ${isSelected ? 'checked' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggleSelection(); }}
      >
        {isSelected && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        )}
      </div>
      <span className="workspace-item-icon">
        {getWorkspaceIcon(detectedIcon)}
      </span>
      <span className="workspace-item-name">{name}</span>
      <span className="workspace-item-chevron">
        <ChevronRightIcon size={12} />
      </span>
    </div>
  );
};

// ── Sidebar Component ───────────────────────────────

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  workspaces,
  smartViewCounts,
  activeView,
  onViewChange,
  onAddFolder,
  onOpenSettings,
  onSearch,
  onWorkspaceContextMenu,
  activeFileContent,
  activeFileExtension,
  activeFileId,
  selectedWorkspaces,
  onToggleWorkspaceSelection,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGlobal, setSearchGlobal] = useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value, searchGlobal);
  };

  const toggleSearchScope = () => {
    const newGlobal = !searchGlobal;
    setSearchGlobal(newGlobal);
    onSearch(searchQuery, newGlobal);
  };

  return (
    <div className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <img src="/icon.png" alt="EXT Logo" className="sidebar-brand-icon-img" />
        <span className="sidebar-brand-name">EXT</span>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <div className="sidebar-search-input-wrapper">
          <SearchIcon size={14} className="sidebar-search-icon" />
          <input
            id="global-search-input"
            type="text"
            className="sidebar-search-input"
            placeholder="Search all files..."
            value={searchQuery}
            onChange={handleSearch}
          />
          <button 
            className={`sidebar-search-scope-btn ${searchGlobal ? 'global' : ''}`}
            onClick={toggleSearchScope}
            title={searchGlobal ? 'Search in all workspaces' : 'Search in current view'}
          >
            {searchGlobal ? 'All' : 'View'}
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="sidebar-content">
        {/* Smart Views */}
        <SidebarSection title="Smart Views">
          <SmartViewItem
            icon={<ClockIcon size={14} />}
            label="Recent"
            count={smartViewCounts.recent}
            viewId="recent"
            isActive={activeView === 'recent'}
            onClick={() => onViewChange('recent')}
          />
          <SmartViewItem
            icon={<StarIcon size={14} />}
            label="Favorites"
            count={smartViewCounts.favorites}
            viewId="favorites"
            isActive={activeView === 'favorites'}
            onClick={() => onViewChange('favorites')}
          />
          <SmartViewItem
            icon={<FileMarkdownIcon size={14} />}
            label="All Markdown"
            count={smartViewCounts.allMarkdown}
            viewId="allMarkdown"
            isActive={activeView === 'allMarkdown'}
            onClick={() => onViewChange('allMarkdown')}
          />
          <SmartViewItem
            icon={<FileTextIcon size={14} />}
            label="All Text"
            count={smartViewCounts.allText}
            viewId="allText"
            isActive={activeView === 'allText'}
            onClick={() => onViewChange('allText')}
          />
          <SmartViewItem
            icon={<CalendarIcon size={14} />}
            label="Modified Today"
            count={smartViewCounts.modifiedToday}
            viewId="modifiedToday"
            isActive={activeView === 'modifiedToday'}
            onClick={() => onViewChange('modifiedToday')}
          />
          <SmartViewItem
            icon={<ChecklistIcon size={14} />}
            label="TODOs"
            count={smartViewCounts.todos}
            viewId="todos"
            isActive={activeView === 'todos'}
            onClick={() => onViewChange('todos')}
          />
        </SidebarSection>

        {/* Workspaces */}
        <SidebarSection title="Workspaces">
          {workspaces.map((ws) => (
            <WorkspaceItem
              key={ws.id}
              id={ws.id}
              name={ws.name}
              detectedIcon={ws.detectedIcon}
              isActive={activeView === `ws-${ws.id}`}
              onClick={() => onViewChange(`ws-${ws.id}`)}
              onContextMenu={(e) => onWorkspaceContextMenu?.(e, ws.id)}
              isSelected={selectedWorkspaces.has(ws.id)}
              onToggleSelection={() => onToggleWorkspaceSelection(ws.id)}
            />
          ))}
        </SidebarSection>

        {/* Outline */}
        {activeFileExtension && supportsOutline(activeFileExtension) && activeFileContent && activeFileId && (
          <SidebarSection title="Outline" defaultExpanded={true}>
            <MarkdownOutline content={activeFileContent} fileId={activeFileId} isMarkdown={true} />
          </SidebarSection>
        )}
      </div>

      {/* Bottom Area */}
      <div className="sidebar-bottom">
        <button className="sidebar-btn sidebar-btn-primary" onClick={onAddFolder}>
          <PlusIcon size={14} />
          Add Folder
        </button>

        <button className="sidebar-settings" onClick={onOpenSettings} title="Settings">
          <SettingsIcon size={16} />
        </button>
      </div>
    </div>
  );
});
