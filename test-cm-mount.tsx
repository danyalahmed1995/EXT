import React from 'react';
import { createRoot } from 'react-dom/client';
import { CodeMirrorEditor } from './src/components/editor/CodeMirrorEditor';

// Mock navigation timing array
window.__NAV_PERF = {};

const content = "a".repeat(5000000);

const container = document.createElement('div');
document.body.appendChild(container);

const root = createRoot(container);

console.time('Mount CodeMirrorEditor (Huge)');
root.render(
  <CodeMirrorEditor
    activeTabId="huge-tab"
    content={content}
    onChange={() => {}}
    onSave={() => {}}
    isActive={true}
  />
);

// Wait a bit for React to mount
setTimeout(() => {
  console.timeEnd('Mount CodeMirrorEditor (Huge)');
}, 100);
