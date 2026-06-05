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
  relativePath: string;
  modifiedAt: string;
  size: number;
  isFavorite: boolean;
  isPinned: boolean;
  content: string;
}
