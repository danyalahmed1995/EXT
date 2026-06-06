import fs from 'fs';

const appPath = 'src/App.tsx';
let content = fs.readFileSync(appPath, 'utf-8');

// The required variables from useAppLogic based on App.tsx usage:
const needed = [
  'activeView', 'setActiveView',
  'viewMode', 'setViewMode',
  'activeFileId', 'setActiveFileId',
  'openTabs',
  'workspaces',
  'sortMode', 'setSortMode',
  'appearance', 'setAppearance',
  'setSearchQuery',
  'setSearchGlobal',
  'showNewFileModal', 'setShowNewFileModal',
  'showSettingsModal', 'setShowSettingsModal',
  'renameFileTarget', 'setRenameFileTarget',
  'renameWorkspaceTarget', 'setRenameWorkspaceTarget',
  'contextMenu', 'setContextMenu',
  'toastMessage',
  'handleFileSelect',
  'handleTabClose',
  'handleContentChange',
  'handleToggleFavorite',
  'handleAddFolder',
  'handleRemoveAllWorkspaces',
  'handleCreateFile',
  'handleRenameFile',
  'handleRenameWorkspace',
  'handleSaveFile',
  'handleDeleteFile',
  'handleCopyFile',
  'handleFileListContextMenu',
  'handleWorkspaceContextMenu',
  'getSmartViewCounts',
  'getFilteredFiles',
  'getViewTitle',
  'sensors',
  'handleDragEnd'
];

// Replace the const { ... } = useAppLogic() block with the exact needed variables
const hookCallRegex = /const \{[\s\S]*?\} = useAppLogic\(\);/;
const newHookCall = `const {
  ${needed.join(',\n  ')}
} = useAppLogic();`;
content = content.replace(hookCallRegex, newHookCall);

// Remove unused imports at the top
content = content.replace(/import React from "react";\r?\n/, '');
content = content.replace(/import \{ EditorTab, ViewMode \} from '\.\/components\/editor\/EditorPanel';\r?\n/, "import { ViewMode } from './components/editor/EditorPanel';\n");
content = content.replace(/import \{ ContextMenuItem \} from '\.\/components\/context-menu\/ContextMenu';\r?\n/, '');
content = content.replace(/import \{ Workspace, FileItem, SortMode, AppearanceSettings \} from '\.\/types';\r?\n/, '');
content = content.replace(/import \{ invoke \} from '@tauri-apps\/api\/core';\r?\n/, '');
content = content.replace(/import \{ open, ask \} from '@tauri-apps\/plugin-dialog';\r?\n/, '');
content = content.replace(/import \{ listen \} from '@tauri-apps\/api\/event';\r?\n/, '');
content = content.replace(/import \{ DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, pointerWithin \} from '@dnd-kit\/core';\r?\n/, "import { DndContext, pointerWithin } from '@dnd-kit/core';\n");

// Also there is another import block for the unused types:
content = content.replace(/import \{ EditorTab \} from '\.\/components\/editor\/EditorPanel';\r?\n/, '');
// If there's a big import block:
content = content.replace(/import \{ EditorPanel, EditorTab, ViewMode \} from '\.\/components\/editor\/EditorPanel';/, "import { EditorPanel, ViewMode } from './components/editor/EditorPanel';");
content = content.replace(/import \{ ContextMenu, ContextMenuItem \} from '\.\/components\/context-menu\/ContextMenu';/, "import { ContextMenu } from './components/context-menu/ContextMenu';");
content = content.replace(/import \{ Workspace, FileItem, SortMode, AppearanceSettings \} from '\.\/types';/, '');

fs.writeFileSync(appPath, content);
console.log('App.tsx unused variables and imports removed.');
