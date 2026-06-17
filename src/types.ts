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
  hasTodos?: boolean;
}

export type SortMode = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'custom';

export type LargeFileThresholdPreset = '20mb' | '50mb' | '100mb' | '250mb' | '500mb' | 'custom';

export interface LargeFileSettings {
  autoEnable: boolean;
  thresholdPreset: LargeFileThresholdPreset;
  customThresholdMb: number;
  askBeforeOpening: boolean;
  showDetailsPanel: boolean;
  allowNormalEditor: boolean;
}

export interface AppearanceSettings {
  animations: boolean;
  premiumEffects: boolean;
  smoothTabs: boolean;
  sidebarHover: boolean;
  editorFocus: boolean;
  previewTransitions: boolean;
  reduceMotion: boolean;
  ignoredDirs: string[];
  enableProfiler?: boolean;
  previewCentered?: boolean;
  enableTerminal?: boolean;
  terminalAutoSyncCwd?: boolean;
  largeFileMode: LargeFileSettings;
}

export interface RestoredTab {
  id: string;
  path: string;
  workspaceId?: string;
  workspaceRoot?: string;
  title?: string;
  isPinned?: boolean;
}

export interface RestoredSession {
  version: number;
  activeWorkspaceId?: string;
  activeWorkspaceRoot?: string;
  activeTabId?: string;
  activeTabPath?: string;
  openTabs: RestoredTab[];
  viewMode?: 'editor' | 'preview' | 'split';
}

export interface PathStatus {
  exists: boolean;
  parent_exists: boolean;
  root_exists: boolean;
  error?: string;
}
