import fs from 'fs';

const appPath = 'src/App.tsx';
let content = fs.readFileSync(appPath, 'utf-8');

// 1. Find boundaries
const startIdx = content.indexOf('function App() {') + 'function App() {'.length;
const renderIdx = content.indexOf('// ── Render ────────────────────────────────────────');

const beforeApp = content.slice(0, startIdx - 'function App() {'.length);
const appBody = content.slice(startIdx, renderIdx);
const afterRender = content.slice(renderIdx);

// 2. We need to define useAppLogic in src/hooks/useAppLogic.ts
// We'll just export all imports needed.
const hookImports = `import { useState, useCallback, useEffect } from 'react';
import { ViewMode, EditorTab } from '../components/editor/EditorPanel';
import { ContextMenuItem } from '../components/context-menu/ContextMenu';
import { Workspace, FileItem, SortMode, AppearanceSettings } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { DragEndEvent } from '@dnd-kit/core';
`;

// Extract exported variables for the hook return
// We'll do a simple regex for const [foo] =, const handleFoo = useCallback, const getFoo =
const vars = [];
const regexes = [
    /const \[([a-zA-Z0-9_]+), /g,
    /const (handle[a-zA-Z0-9_]+) = useCallback/g,
    /const (get[a-zA-Z0-9_]+) = useCallback/g,
    /const (open[a-zA-Z0-9_]+) = useCallback/g,
    /const (show[a-zA-Z0-9_]+) = /g,
];

for (const regex of regexes) {
    let match;
    while ((match = regex.exec(appBody)) !== null) {
        vars.push(match[1]);
    }
}

// Ensure unique
const uniqueVars = [...new Set(vars)];

const hookFile = `${hookImports}
export function useAppLogic() {
${appBody}
  return {
    ${uniqueVars.join(',\n    ')}
  };
}
`;

fs.mkdirSync('src/hooks', { recursive: true });
fs.writeFileSync('src/hooks/useAppLogic.ts', hookFile);

// 3. Rewrite App.tsx
const newAppTsx = `${beforeApp.replace(/import \{ useState, useCallback, useEffect \} from 'react';/, 'import React from "react";')}
import { useAppLogic } from './hooks/useAppLogic';

function App() {
  const {
    ${uniqueVars.join(',\n    ')}
  } = useAppLogic();

${afterRender}
`;

fs.writeFileSync(appPath, newAppTsx);
console.log('App.tsx refactored successfully!');
