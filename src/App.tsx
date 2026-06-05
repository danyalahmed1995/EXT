import { useState, useCallback, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Sidebar } from './components/sidebar/Sidebar';
import { FileList } from './components/file-list/FileList';
import { EditorPanel, EditorTab, ViewMode } from './components/editor/EditorPanel';
import { NewFileModal } from './components/modals/NewFileModal';
import { ContextMenu, ContextMenuItem } from './components/context-menu/ContextMenu';
import { mockWorkspaces, mockFiles, MockWorkspace, MockFile } from './data/mockData';
import { invoke } from '@tauri-apps/api/core';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

function App() {
  // ── State ─────────────────────────────────────────

  const [activeView, setActiveView] = useState('allMarkdown');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [activeFileId, setActiveFileId] = useState<string | null>('f-1');
  const [openTabs, setOpenTabs] = useState<EditorTab[]>(() => {
    const firstFile = mockFiles[0];
    return firstFile
      ? [{
          id: firstFile.id,
          name: firstFile.name,
          extension: firstFile.extension,
          content: firstFile.content,
          isDirty: false,
        }]
      : [];
  });
  const [files, setFiles] = useState<MockFile[]>(mockFiles);
  const [workspaces, setWorkspaces] = useState<MockWorkspace[]>(mockWorkspaces);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGlobal, setSearchGlobal] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);

  // ── Smart view counts (dynamic) ───────────────────

  const getSmartViewCounts = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      recent: Math.min(files.length, 5),
      favorites: files.filter((f) => f.isFavorite).length,
      allMarkdown: files.filter((f) => f.extension === '.md' || f.extension === '.markdown').length,
      allText: files.filter((f) => f.extension === '.txt').length,
      modifiedToday: files.filter((f) => new Date(f.modifiedAt) >= today).length,
      todos: files.filter(
        (f) =>
          f.content.includes('TODO') ||
          f.content.includes('- [ ]') ||
          f.content.includes('- [x]') ||
          f.content.includes('- [X]')
      ).length,
    };
  }, [files]);

  // ── View Filtering ────────────────────────────────

  const getFilteredFiles = useCallback(() => {
    let result = files;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
      
      if (searchGlobal) {
        // Bypass active view filtering if we are searching globally
        return result;
      }
    }

    switch (activeView) {
      case 'recent':
        return [...result]
          .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
          .slice(0, 5);
      case 'favorites':
        return result.filter((f) => f.isFavorite);
      case 'allMarkdown':
        return result.filter((f) => f.extension === '.md' || f.extension === '.markdown');
      case 'allText':
        return result.filter((f) => f.extension === '.txt');
      case 'modifiedToday': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return result.filter((f) => new Date(f.modifiedAt) >= today);
      }
      case 'todos':
        return result.filter(
          (f) =>
            f.content.includes('TODO') ||
            f.content.includes('- [ ]') ||
            f.content.includes('- [x]') ||
            f.content.includes('- [X]')
        );
      default:
        if (activeView.startsWith('ws-')) {
          const wsId = activeView.replace('ws-', '');
          return result.filter((f) => f.workspaceId === wsId);
        }
        return result;
    }
  }, [activeView, files, searchQuery, searchGlobal]);

  const getViewTitle = useCallback(() => {
    switch (activeView) {
      case 'recent': return 'Recent';
      case 'favorites': return 'Favorites';
      case 'allMarkdown': return 'All Markdown';
      case 'allText': return 'All Text';
      case 'modifiedToday': return 'Modified Today';
      case 'todos': return 'TODOs';
      default:
        if (activeView.startsWith('ws-')) {
          const wsId = activeView.replace('ws-', '');
          const ws = workspaces.find((w) => w.id === wsId);
          return ws?.name ?? 'Unknown';
        }
        return 'Files';
    }
  }, [activeView, workspaces]);

  // ── File Handlers ─────────────────────────────────

  const handleFileSelect = useCallback(
    (fileId: string) => {
      setActiveFileId(fileId);
      if (!openTabs.find((t) => t.id === fileId)) {
        const file = files.find((f) => f.id === fileId);
        if (file) {
          setOpenTabs((tabs) => [
            ...tabs,
            {
              id: file.id,
              name: file.name,
              extension: file.extension,
              content: file.content,
              isDirty: false,
            },
          ]);
        }
      }
    },
    [openTabs, files]
  );

  const handleTabClose = useCallback(
    (tabId: string) => {
      setOpenTabs((tabs) => tabs.filter((t) => t.id !== tabId));
      if (activeFileId === tabId) {
        const remaining = openTabs.filter((t) => t.id !== tabId);
        setActiveFileId(
          remaining.length > 0 ? remaining[remaining.length - 1].id : null
        );
      }
    },
    [activeFileId, openTabs]
  );

  const handleContentChange = useCallback((tabId: string, content: string) => {
    setOpenTabs((tabs) =>
      tabs.map((t) =>
        t.id === tabId ? { ...t, content, isDirty: true } : t
      )
    );
  }, []);

  const handleTabReorder = useCallback((dragIndex: number, hoverIndex: number) => {
    setOpenTabs((prevTabs) => {
      const newTabs = [...prevTabs];
      const [draggedTab] = newTabs.splice(dragIndex, 1);
      newTabs.splice(hoverIndex, 0, draggedTab);
      return newTabs;
    });
  }, []);

  const handleToggleFavorite = useCallback((fileId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, isFavorite: !f.isFavorite } : f
      )
    );
  }, []);

  // ── Add Folder Handler ────────────────────────────

  const handleAddFolder = useCallback(async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Folder to Add',
      });

      if (!selectedPath) {
        // User canceled
        return;
      }

      // Extract the folder name from the path (handles both / and \ separators)
      const name = selectedPath.split(/[/\\]/).pop() || 'Unknown Workspace';
      const newId = `ws-${Date.now()}`;
      
      const result: { files: MockFile[], detectedIcon: string } = await invoke('scan_directory', {
        path: selectedPath,
        workspaceId: newId,
        workspaceName: name,
      });

      const newWorkspace: MockWorkspace = {
        id: newId,
        name,
        path: selectedPath,
        detectedIcon: result.detectedIcon,
      };

      setWorkspaces((prev) => [...prev, newWorkspace]);
      setFiles((prev) => [...prev, ...result.files]);
      setActiveView(`ws-${newId}`);
    } catch (err) {
      console.error('Failed to pick or scan directory:', err);
      alert(`Failed to pick or scan directory: ${err}`);
    }
  }, []);

  const handleRemoveWorkspace = useCallback((workspaceId: string) => {
    // Remove workspace
    setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    
    // Remove associated files
    setFiles((prev) => prev.filter((f) => f.workspaceId !== workspaceId));
    
    // Close associated tabs
    const tabsToClose = files.filter((f) => f.workspaceId === workspaceId).map(f => f.id);
    if (tabsToClose.length > 0) {
      setOpenTabs((prev) => prev.filter((t) => !tabsToClose.includes(t.id)));
      if (activeFileId && tabsToClose.includes(activeFileId)) {
        setActiveFileId(null);
      }
    }

    // Update active view if it was pointing to this workspace
    if (activeView === `ws-${workspaceId}`) {
      setActiveView('allMarkdown');
    }
  }, [files, activeView, activeFileId]);

  // ── New File Handler ──────────────────────────────

  const handleCreateFile = useCallback(async (workspaceId: string, fileName: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;

    try {
      const newFile: MockFile = await invoke('create_file', {
        workspacePath: ws.path,
        workspaceId: ws.id,
        workspaceName: ws.name,
        fileName,
      });

      setFiles((prev) => [...prev, newFile]);
      setActiveView(`ws-${ws.id}`);

      // Open the new file in editor
      setOpenTabs((tabs) => [
        ...tabs,
        {
          id: newFile.id,
          name: newFile.name,
          extension: newFile.extension,
          content: newFile.content,
          isDirty: false,
        },
      ]);
      setActiveFileId(newFile.id);
    } catch (err) {
      console.error('Failed to create file:', err);
      alert(`Failed to create file: ${err}`);
    }
  }, [workspaces]);

  const handleMoveFile = useCallback(async (fileId: string, targetWorkspaceId: string) => {
    const file = files.find(f => f.id === fileId);
    const sourceWs = workspaces.find(w => w.id === file?.workspaceId);
    const targetWs = workspaces.find(w => w.id === targetWorkspaceId);

    if (!file || !sourceWs || !targetWs || sourceWs.id === targetWs.id) return;

    try {
      const movedFile: MockFile = await invoke('move_file', {
        sourceWorkspacePath: sourceWs.path,
        targetWorkspacePath: targetWs.path,
        relativePath: file.relativePath,
      });

      // Update file ID and workspace info since backend returned a dummy ID
      const newFileId = `moved-${Date.now()}`;
      movedFile.id = newFileId;
      movedFile.workspaceId = targetWs.id;
      movedFile.workspace = targetWs.name;
      movedFile.isFavorite = file.isFavorite; // Preserve favorite status
      
      setFiles((prev) => [
        ...prev.filter(f => f.id !== fileId),
        movedFile
      ]);

      // Update active file ID if it was moved
      if (activeFileId === fileId) {
        setActiveFileId(newFileId);
      }

      // Update open tabs if it was open
      setOpenTabs((prev) => 
        prev.map((t) => t.id === fileId ? { ...t, id: newFileId } : t)
      );
    } catch (err) {
      console.error('Failed to move file:', err);
      alert(`Failed to move file: ${err}`);
    }
  }, [files, workspaces, activeFileId]);

  // ── Save File Handler ───────────────────────────────

  const handleSaveFile = useCallback(async (tabId: string) => {
    const tab = openTabs.find((t) => t.id === tabId);
    const file = files.find((f) => f.id === tabId);
    const workspace = workspaces.find((w) => w.id === file?.workspaceId);

    if (!tab || !file || !workspace || !tab.isDirty) return;

    try {
      const modifiedAt = await invoke('save_file', {
        workspacePath: workspace.path,
        relativePath: file.relativePath,
        content: tab.content,
      });

      // Update file list modified date
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, modifiedAt: modifiedAt as string, content: tab.content } : f
        )
      );

      // Clear dirty flag
      setOpenTabs((prev) =>
        prev.map((t) => (t.id === tab.id ? { ...t, isDirty: false } : t))
      );
    } catch (err) {
      console.error('Failed to save file:', err);
      alert(`Failed to save file: ${err}`);
    }
  }, [openTabs, files, workspaces]);

  // ── Delete File Handler ─────────────────────────────

  const handleDeleteFile = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    const workspace = workspaces.find(w => w.id === file?.workspaceId);
    
    if (!file || !workspace) return;

    const confirmed = await ask(`Are you sure you want to delete "${file.name}"? This action cannot be undone.`, {
      title: 'Confirm Deletion',
      kind: 'warning',
    });

    if (!confirmed) return;

    try {
      await invoke('delete_file', {
        workspacePath: workspace.path,
        relativePath: file.relativePath,
      });

      // Remove from files state
      setFiles((prev) => prev.filter((f) => f.id !== fileId));

      // Close tab if open
      setOpenTabs((prev) => prev.filter((t) => t.id !== fileId));
      if (activeFileId === fileId) {
        setActiveFileId(null);
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
      alert(`Failed to delete file: ${err}`);
    }
  }, [files, workspaces, activeFileId]);

  // ── Context Menus ───────────────────────────────────

  useEffect(() => {
    const handleEditorContextMenu = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { x, y, tabId } = customEvent.detail;
      if (!tabId) return;

      setContextMenu({
        x,
        y,
        items: [
          {
            label: 'Save',
            shortcut: 'Ctrl+S',
            onClick: () => handleSaveFile(tabId),
          },
        ],
      });
    };

    window.addEventListener('editor-context-menu', handleEditorContextMenu);
    return () => window.removeEventListener('editor-context-menu', handleEditorContextMenu);
  }, [handleSaveFile]);

  const handleFileListContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: 'New File',
          shortcut: 'Ctrl+N',
          onClick: () => setShowNewFileModal(true)
        },
        {
          label: 'Export / Copy to...',
          onClick: () => {
            alert('Export feature coming soon! (Tauri drag-out to OS is not natively supported on Windows)');
          }
        }
      ],
    });
  }, []);

  // ── Drag & Drop Handlers ──────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === 'tab' && overType === 'tab') {
      if (active.id !== over.id) {
        const oldIndex = openTabs.findIndex((t) => `tab-${t.id}` === active.id);
        const newIndex = openTabs.findIndex((t) => `tab-${t.id}` === over.id);
        handleTabReorder(oldIndex, newIndex);
      }
    } else if (activeType === 'file' && overType === 'workspace') {
      const fileId = active.data.current?.fileId;
      const workspaceId = over.data.current?.workspaceId;
      if (fileId && workspaceId) {
        handleMoveFile(fileId, workspaceId);
      }
    }
  };

  // ── Render ────────────────────────────────────────

  const filteredFiles = getFilteredFiles();
  const smartViewCounts = getSmartViewCounts();

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <AppShell
        sidebar={
          <Sidebar
            workspaces={workspaces}
            smartViewCounts={smartViewCounts}
            activeView={activeView}
            onViewChange={setActiveView}
            onAddFolder={handleAddFolder}
            onOpenSettings={() => {/* TODO: Phase 12 */}}
            onSearch={(query, global) => {
              setSearchQuery(query);
              setSearchGlobal(global);
            }}
            onMoveFile={handleMoveFile}
            onWorkspaceContextMenu={(e, workspaceId) => {
              e.preventDefault();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                  {
                    label: 'Remove Workspace',
                    onClick: () => handleRemoveWorkspace(workspaceId)
                  }
                ]
              });
            }}
          />
        }
        fileList={
          <FileList
            title={getViewTitle()}
            files={filteredFiles.map((f) => ({
              id: f.id,
              name: f.name,
              extension: f.extension,
              workspace: f.workspace,
              modifiedAt: f.modifiedAt,
              isFavorite: f.isFavorite,
              size: f.size,
            }))}
            activeFileId={activeFileId}
            onFileSelect={handleFileSelect}
            onToggleFavorite={handleToggleFavorite}
            onDeleteFile={handleDeleteFile}
            onContextMenu={handleFileListContextMenu}
          />
        }
        editor={
          <EditorPanel
            tabs={openTabs}
            activeTabId={activeFileId}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onTabSelect={setActiveFileId}
            onTabClose={handleTabClose}
            onContentChange={handleContentChange}
            onSaveFile={handleSaveFile}
            onTabReorder={handleTabReorder}
            onNewFile={() => setShowNewFileModal(true)}
            onOpenSettings={() => {/* TODO: Phase 12 */}}
          />
        }
      />

      {/* Modals & Context Menus */}
      {showNewFileModal && (
        <NewFileModal
          workspaces={workspaces.map(w => ({ id: w.id, name: w.name, path: w.path }))}
          defaultWorkspaceId={activeView.startsWith('ws-') ? activeView.replace('ws-', '') : undefined}
          onClose={() => setShowNewFileModal(false)}
          onCreate={handleCreateFile}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </DndContext>
  );
}

export default App;
