export interface Workspace {
  id: string;
  name: string;
  path: string;
  detectedIcon: string;
}

export interface FileItem {
  id: string;
  workspaceId: string;
  name: string;
  extension: string;
  workspace: string;
  absolutePath: string;
  relativePath: string;
  modifiedAt: string;
  size: number;
  isFavorite: boolean;
  isPinned: boolean;
  content: string; // the actual raw content
}

export type SortMode = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'custom';

export interface AppearanceSettings {
  animations: boolean;
  premiumEffects: boolean;
  smoothTabs: boolean;
  sidebarHover: boolean;
  editorFocus: boolean;
  previewTransitions: boolean;
  reduceMotion: boolean;
}
