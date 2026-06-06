import fs from 'fs';

const hookPath = 'src/hooks/useAppLogic.ts';
let content = fs.readFileSync(hookPath, 'utf-8');

// Fix imports
content = content.replace(
  "import { DragEndEvent } from '@dnd-kit/core';",
  "import { DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';"
);

// Fix f.content errors
// 1. In getSmartViewCounts: f.content.includes...
content = content.replace(
  /f\.content\.includes\('TODO'\) \|\|[\s\S]*?f\.content\.includes\('- \[X\]'\)/g,
  "f.hasTodos"
);

// 2. In handleFileSelect: fallbacks for content.
// Since content is no longer in FileItem, we can't do file.content.
// Just fallback to empty string if read_file fails.
content = content.replace(/content: content \|\| file\.content,/g, "content: content || '',");
content = content.replace(/content: file\.content,/g, "content: '',");

// 3. newFile.content in handleCreateFile
content = content.replace(/content: newFile\.content,/g, "content: '',");

// Fix setters not being exported. We need to export all missing ones:
// setViewMode, setShowSettingsModal, setSearchQuery, setSearchGlobal, setShowNewFileModal, setRenameFileTarget, setRenameWorkspaceTarget, setAppearance, setContextMenu, setActiveView, setSortMode
const exportsToAdd = [
  'setViewMode',
  'setShowSettingsModal',
  'setSearchQuery',
  'setSearchGlobal',
  'setShowNewFileModal',
  'setRenameFileTarget',
  'setRenameWorkspaceTarget',
  'setAppearance',
  'setContextMenu',
  'setActiveView',
  'setSortMode',
  'sensors',
  'handleDragEnd',
];

const returnIdx = content.lastIndexOf('return {');
const returnStr = 'return {\n    ' + exportsToAdd.join(',\n    ') + ',';
content = content.replace('return {', returnStr);

fs.writeFileSync(hookPath, content);

// Now App.tsx needs these destructured
const appPath = 'src/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf-8');

const appDestructIdx = appContent.indexOf('const {');
const appDestructStr = 'const {\n    ' + exportsToAdd.join(',\n    ') + ',';
appContent = appContent.replace('const {', appDestructStr);

// Also remove `sensors` and `handleDragEnd` from App.tsx since they are destructured now.
// Actually, sensors and handleDragEnd were used in App.tsx but they are now destructured, so we don't need to define them in App.tsx. They were moved to useAppLogic.ts by the first script.

fs.writeFileSync(appPath, appContent);

console.log('Fixed useAppLogic.ts and App.tsx');
