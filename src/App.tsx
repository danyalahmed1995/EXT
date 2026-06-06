import { useState, useCallback, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Sidebar } from './components/sidebar/Sidebar';
import { FileList } from './components/file-list/FileList';
import { EditorPanel, EditorTab, ViewMode } from './components/editor/EditorPanel';
import { NewFileModal } from './components/modals/NewFileModal';
import { RenameModal } from './components/modals/RenameModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { ContextMenu, ContextMenuItem } from './components/context-menu/ContextMenu';
import { Workspace, FileItem, SortMode } from './types';
import { invoke } from '@tauri-apps/api/core';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core';

function App() {
  // ── State ─────────────────────────────────────────

  const [activeView, setActiveView] = useState('allMarkdown');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [activeFileId, setActiveFileId] = useState<string | null>('f-1');
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');
  const [customFileOrder, setCustomFileOrder] = useState<Record<string, string[]>>({});

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGlobal, setSearchGlobal] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [renameFileTarget, setRenameFileTarget] = useState<{ id: string, name: string } | null>(null);
  const [renameWorkspaceTarget, setRenameWorkspaceTarget] = useState<{ id: string, name: string, path: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Initialization (Load Persistence) ───────────────

  useEffect(() => {
    async function loadData() {
      setIsScanning(true);
      try {
        const storedWorkspaces: Workspace[] = JSON.parse(localStorage.getItem('ext_workspaces') || '[]');
        const storedFavorites: string[] = JSON.parse(localStorage.getItem('ext_favorites') || '[]');
        const storedSortMode: SortMode = (localStorage.getItem('ext_sortMode') as SortMode) || 'date-desc';
        const storedCustomOrder: Record<string, string[]> = JSON.parse(localStorage.getItem('ext_customOrder') || '{}');
        
        setWorkspaces(storedWorkspaces);
        setSortMode(storedSortMode);
        setCustomFileOrder(storedCustomOrder);
        
        let allFiles: FileItem[] = [];
        
        // Scan all stored workspaces concurrently
        await Promise.all(
          storedWorkspaces.map(async (ws) => {
            try {
              const result: { files: FileItem[], detectedIcon: string } = await invoke('scan_directory', {
                path: ws.path,
                workspaceId: ws.id,
                workspaceName: ws.name,
              });
              
              // Apply favorite status
              const scannedWithFavs = result.files.map(f => ({
                ...f,
                isFavorite: storedFavorites.includes(f.id) || storedFavorites.includes(f.relativePath), // Fallback to path just in case
              }));
              
              allFiles = allFiles.concat(scannedWithFavs);
            } catch (err) {
              console.error(`Failed to scan workspace ${ws.name}:`, err);
            }
          })
        );
        
        setFiles(allFiles);
        
        // Auto-open recent file or first file if nothing active
        if (allFiles.length > 0) {
          // Sort by modified
          allFiles.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
          const first = allFiles[0];
          setActiveFileId(first.id);
          setOpenTabs([{
            id: first.id,
            name: first.name,
            extension: first.extension,
            content: first.content,
            isDirty: false,
            absolutePath: first.absolutePath,
          }]);
        } else {
          setActiveFileId(null);
        }
      } catch (e) {
        console.error('Error loading initialization data:', e);
      } finally {
        setIsScanning(false);
      }
    }
    
    loadData();
  }, []);

  // Sync workspaces to localStorage when changed
  useEffect(() => {
    if (!isScanning) {
      localStorage.setItem('ext_workspaces', JSON.stringify(workspaces));
    }
  }, [workspaces, isScanning]);

  // Sync favorites to localStorage when changed
  useEffect(() => {
    if (!isScanning) {
      const favorites = files.filter(f => f.isFavorite).map(f => f.id);
      localStorage.setItem('ext_favorites', JSON.stringify(favorites));
    }
  }, [files, isScanning]);

  // Sync sort state
  useEffect(() => {
    if (!isScanning) {
      localStorage.setItem('ext_sortMode', sortMode);
      localStorage.setItem('ext_customOrder', JSON.stringify(customFileOrder));
    }
  }, [sortMode, customFileOrder, isScanning]);

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
          result = result.filter((f) => f.workspaceId === wsId);
        }
        break;
    }

    // Apply Sorting
    if (sortMode === 'custom' && customFileOrder[activeView]) {
      const orderMap = new Map(customFileOrder[activeView].map((id, index) => [id, index]));
      result.sort((a, b) => {
        const indexA = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
        const indexB = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
        return indexA - indexB;
      });
    } else if (sortMode === 'date-desc') {
      result.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    } else if (sortMode === 'date-asc') {
      result.sort((a, b) => new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime());
    } else if (sortMode === 'name-asc') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'name-desc') {
      result.sort((a, b) => b.name.localeCompare(a.name));
    }

    return result;
  }, [activeView, files, searchQuery, searchGlobal, sortMode, customFileOrder]);

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
        const workspace = workspaces.find((w) => w.id === file?.workspaceId);
        if (file && workspace) {
          // If the file is >2MB, the content might be a placeholder. We should really read it here via invoke('read_file')
          // but for now we will just use the content we got, or maybe fetch it.
          // Since the prompt requires MVP and 2MB limit was added, we can read the file live.
          invoke<string>('read_file', { workspacePath: workspace.path, relativePath: file.relativePath }).then((content) => {
            setOpenTabs((tabs) => [
              ...tabs,
              {
                id: file.id,
                name: file.name,
                extension: file.extension,
                content: content || file.content,
                isDirty: false,
                absolutePath: file.absolutePath,
              },
            ]);
          }).catch(() => {
             // Fallback
             setOpenTabs((tabs) => [
              ...tabs,
              {
                id: file.id,
                name: file.name,
                extension: file.extension,
                content: file.content,
                isDirty: false,
                absolutePath: file.absolutePath,
              },
            ]);
          });
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
      tabs.map((t) => {
        if (t.id === tabId) {
          if (t.content === content) return t;
          return { ...t, content, isDirty: true, saveStatus: 'unsaved' };
        }
        return t;
      })
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
      
      const result: { files: FileItem[], detectedIcon: string } = await invoke('scan_directory', {
        path: selectedPath,
        workspaceId: newId,
        workspaceName: name,
      });

      const newWorkspace: Workspace = {
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

  const handleAddFolderByPath = useCallback(async (selectedPath: string) => {
    try {
      const name = selectedPath.split(/[/\\]/).pop() || 'Unknown Workspace';
      const newId = `ws-${Date.now()}`;
      
      const result: { files: FileItem[], detectedIcon: string } = await invoke('scan_directory', {
        path: selectedPath,
        workspaceId: newId,
        workspaceName: name,
      });

      const newWorkspace: Workspace = {
        id: newId,
        name,
        path: selectedPath,
        detectedIcon: result.detectedIcon,
      };

      setWorkspaces((prev) => {
        if (prev.find(w => w.path === selectedPath)) return prev;
        return [...prev, newWorkspace];
      });
      setFiles((prev) => {
        const filtered = prev.filter(f => f.workspaceId !== newId);
        return [...filtered, ...result.files];
      });
      setActiveView(`ws-${newId}`);
    } catch (err) {
      console.error('Failed to scan dropped directory:', err);
      // Fails silently if a file is dropped instead of a folder
    }
  }, []);

  useEffect(() => {
    const unlistens: (() => void)[] = [];
    
    listen('tauri://drag-drop', (event: any) => {
      const paths = event.payload?.paths;
      if (Array.isArray(paths)) {
        paths.forEach(p => handleAddFolderByPath(p));
      }
    }).then(u => unlistens.push(u));
    
    listen('tauri://file-drop', (event: any) => {
      const paths = event.payload;
      if (Array.isArray(paths)) {
        paths.forEach(p => handleAddFolderByPath(p));
      }
    }).then(u => unlistens.push(u));

    return () => {
      unlistens.forEach(u => u());
    };
  }, [handleAddFolderByPath]);

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

  const handleRemoveAllWorkspaces = useCallback(() => {
    setWorkspaces([]);
    setFiles([]);
    setOpenTabs([]);
    setActiveFileId(null);
    setActiveView('allMarkdown');
  }, []);

  // ── New File Handler ──────────────────────────────

  const handleCreateFile = useCallback(async (workspaceId: string, fileName: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;

    try {
      const newFile: FileItem = await invoke('create_file', {
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
          saveStatus: 'saved',
          absolutePath: newFile.absolutePath,
        },
      ]);
      setActiveFileId(newFile.id);
    } catch (err) {
      console.error('Failed to create file:', err);
      alert(`Failed to create file: ${err}`);
    }
  }, [workspaces]);

  const openRenameFileModal = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) setRenameFileTarget({ id: file.id, name: file.name });
  }, [files]);

  const handleRenameFile = useCallback(async (newName: string) => {
    if (!renameFileTarget) return;
    const file = files.find(f => f.id === renameFileTarget.id);
    const ws = workspaces.find(w => w.id === file?.workspaceId);
    if (!file || !ws) return;

    if (newName === file.name) return;

    try {
      const renamedFile: FileItem = await invoke('rename_file', {
        workspacePath: ws.path,
        relativePath: file.relativePath,
        newName,
      });

      renamedFile.id = file.id;
      renamedFile.workspaceId = ws.id;
      renamedFile.workspace = ws.name;
      renamedFile.isFavorite = file.isFavorite;

      setFiles(prev => prev.map(f => f.id === file.id ? renamedFile : f));
      setOpenTabs(prev => prev.map(t => t.id === file.id ? { ...t, name: renamedFile.name, extension: renamedFile.extension } : t));
    } catch (err) {
      console.error('Failed to rename file:', err);
      alert(`Failed to rename file: ${err}`);
    }
  }, [files, workspaces, renameFileTarget]);

  const openRenameWorkspaceModal = useCallback((workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) setRenameWorkspaceTarget({ id: ws.id, name: ws.name, path: ws.path });
  }, [workspaces]);

  const handleRenameWorkspace = useCallback(async (newName: string) => {
    if (!renameWorkspaceTarget) return;
    try {
      const newPath: string = await invoke('rename_workspace_folder', {
        workspacePath: renameWorkspaceTarget.path,
        newName,
      });

      // Update workspace path and name in state
      setWorkspaces(prev => prev.map(w => w.id === renameWorkspaceTarget.id ? { ...w, name: newName, path: newPath } : w));
      
      // Update all files absolutePath and workspace
      setFiles(prev => prev.map(f => {
         if (f.workspaceId === renameWorkspaceTarget.id) {
            const newAbsolute = f.absolutePath.replace(renameWorkspaceTarget.path, newPath);
            return { ...f, workspace: newName, absolutePath: newAbsolute };
         }
         return f;
      }));

      // Update open tabs
      setOpenTabs(prev => prev.map(t => {
         const f = files.find(file => file.id === t.id);
         if (f && f.workspaceId === renameWorkspaceTarget.id) {
             const newAbsolute = t.absolutePath?.replace(renameWorkspaceTarget.path, newPath);
             return { ...t, absolutePath: newAbsolute };
         }
         return t;
      }));

      showToast(`Workspace folder renamed to "${newName}"`);
    } catch (err) {
      console.error('Failed to rename workspace:', err);
      alert(`Failed to rename workspace: ${err}`);
    }
  }, [renameWorkspaceTarget, files]);

  const handleCreateFolder = useCallback(async (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;

    const folderName = window.prompt('Enter new folder name:');
    if (!folderName) return;

    try {
      await invoke('create_folder', {
        workspacePath: ws.path,
        relativePath: '', // Can be extended to support nested creation
        folderName,
      });

      // Simple refresh to show folder contents or empty folder behavior if needed
      showToast(`Created folder "${folderName}". Files added to it will appear in the workspace.`);
    } catch (err) {
      console.error('Failed to create folder:', err);
      alert(`Failed to create folder: ${err}`);
    }
  }, [workspaces]);

  const handleMoveFile = useCallback(async (fileId: string, targetWorkspaceId: string) => {
    const file = files.find(f => f.id === fileId);
    const sourceWs = workspaces.find(w => w.id === file?.workspaceId);
    const targetWs = workspaces.find(w => w.id === targetWorkspaceId);

    if (!file || !sourceWs || !targetWs || sourceWs.id === targetWs.id) return;

    try {
      const movedFile: FileItem = await invoke('move_file', {
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

    setOpenTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, saveStatus: 'saving' } : t)));

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
        prev.map((t) => (t.id === tab.id ? { ...t, isDirty: false, saveStatus: 'saved' } : t))
      );
    } catch (err) {
      console.error('Failed to save file:', err);
      setOpenTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, saveStatus: 'error' } : t)));
      showToast(`Failed to save file: ${err}`);
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

  // ── Copy File Handler ───────────────────────────────

  const handleCopyFile = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    try {
      await invoke('copy_file_to_clipboard', {
        absolutePath: file.absolutePath
      });
      showToast('File copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy file:', err);
      alert(`Failed to copy file: ${err}`);
    }
  }, [files]);

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

  // ── Keyboard Shortcuts ─────────────────────────────────

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === 's') {
          e.preventDefault();
          if (activeFileId) handleSaveFile(activeFileId);
        } else if (e.key === 'n' && !e.shiftKey) {
          e.preventDefault();
          setShowNewFileModal(true);
        } else if (e.key === 'n' && e.shiftKey) {
          e.preventDefault();
          // Prompt for folder in currently active workspace (or first workspace if none)
          const wsId = activeView.startsWith('ws-') ? activeView.replace('ws-', '') : workspaces[0]?.id;
          if (wsId) {
            handleCreateFolder(wsId);
          }
        } else if (e.key === 'p') {
          e.preventDefault();
          document.getElementById('global-search-input')?.focus();
        }
      } else if (e.key === 'F2') {
        if (activeFileId) {
          openRenameFileModal(activeFileId);
        } else if (activeView.startsWith('ws-')) {
          openRenameWorkspaceModal(activeView.replace('ws-', ''));
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeFileId, handleSaveFile, activeView, workspaces, handleCreateFolder]);

  // ── External File Change Detection ──────────────────────

  const handleWindowFocus = useCallback(async () => {
    if (!activeFileId) return;
    const file = files.find(f => f.id === activeFileId);
    const tab = openTabs.find(t => t.id === activeFileId);
    const ws = workspaces.find(w => w.id === file?.workspaceId);
    
    if (!file || !tab || !ws) return;
    
    try {
      const diskModifiedTime = await invoke<string>('get_file_modified_time', {
        workspacePath: ws.path,
        relativePath: file.relativePath
      });
      
      if (new Date(diskModifiedTime).getTime() > new Date(file.modifiedAt).getTime()) {
        if (tab.isDirty) {
          const confirmed = await ask('This file changed outside EXT. Reloading will replace your unsaved changes.', {
            title: 'External Modification',
            kind: 'warning',
            okLabel: 'Reload from disk',
            cancelLabel: 'Keep current version'
          });
          
          if (confirmed) {
            const newContent = await invoke<string>('read_file', {
              workspacePath: ws.path,
              relativePath: file.relativePath
            });
            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, content: newContent, modifiedAt: diskModifiedTime } : f));
            setOpenTabs(prev => prev.map(t => t.id === file.id ? { ...t, content: newContent, isDirty: false, saveStatus: 'saved' } : t));
          } else {
            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, modifiedAt: diskModifiedTime } : f));
          }
        } else {
          const newContent = await invoke<string>('read_file', {
            workspacePath: ws.path,
            relativePath: file.relativePath
          });
          setFiles(prev => prev.map(f => f.id === file.id ? { ...f, content: newContent, modifiedAt: diskModifiedTime } : f));
          setOpenTabs(prev => prev.map(t => t.id === file.id ? { ...t, content: newContent } : t));
        }
      }
    } catch (e) {
      console.error('Error checking external modification', e);
    }
  }, [activeFileId, files, openTabs, workspaces]);

  useEffect(() => {
    const unlisten = listen('tauri://focus', handleWindowFocus);
    return () => { unlisten.then(u => u()); };
  }, [handleWindowFocus]);

  const handleFileListContextMenu = useCallback((e: React.MouseEvent, fileId?: string) => {
    e.preventDefault();
    if (!fileId) return;
    
    // Select the file that was right-clicked
    handleFileSelect(fileId);

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'New File', onClick: () => setShowNewFileModal(true), shortcut: 'Ctrl+N' },
        { label: 'Reveal in File Explorer', onClick: async () => {
            const file = files.find(f => f.id === fileId);
            const workspace = workspaces.find(w => w.id === file?.workspaceId);
            if (file && workspace) {
              await invoke('reveal_in_explorer', { workspacePath: workspace.path, relativePath: file.relativePath }).catch(err => console.error(err));
            }
          } 
        },
        { label: 'Rename', onClick: () => openRenameFileModal(fileId) },
        { label: 'Copy Path', onClick: () => handleCopyFile(fileId) },
        { divider: true, onClick: () => {} },
        { label: 'Delete', onClick: () => handleDeleteFile(fileId) },
      ]
    });
  }, [files, workspaces, handleDeleteFile, handleCopyFile, handleFileSelect, openRenameFileModal]);

  const handleWorkspaceContextMenu = useCallback((e: React.MouseEvent, workspaceId: string) => {
    e.preventDefault();
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Reveal in File Explorer', onClick: async () => {
            const ws = workspaces.find(w => w.id === workspaceId);
            if (ws) {
              await invoke('reveal_in_explorer', { workspacePath: ws.path, relativePath: null }).catch(err => console.error(err));
            }
          }
        },
        { label: 'New Folder', onClick: () => handleCreateFolder(workspaceId), shortcut: 'Ctrl+Shift+N' },
        { label: 'Rename Workspace', onClick: () => openRenameWorkspaceModal(workspaceId) },
        { divider: true, onClick: () => {} },
        { label: 'Remove Workspace', onClick: () => handleRemoveWorkspace(workspaceId) },
      ]
    });
  }, [workspaces, handleCreateFolder, handleRemoveWorkspace, openRenameWorkspaceModal]);

  const handleFileListDrop = useCallback((draggedId: string, targetId: string) => {
    // Reorder the current filtered view
    const currentFiles = getFilteredFiles();
    const draggedIndex = currentFiles.findIndex(f => f.id === draggedId);
    const targetIndex = currentFiles.findIndex(f => f.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...currentFiles.map(f => f.id)];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    setCustomFileOrder(prev => ({
      ...prev,
      [activeView]: newOrder
    }));
    setSortMode('custom');
  }, [getFilteredFiles, activeView]);

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
    } else if (activeType === 'file' && overType === 'file') {
      if (active.id !== over.id) {
        const draggedFileId = active.data.current?.fileId;
        const targetFileId = over.data.current?.fileId;
        if (draggedFileId && targetFileId) {
          handleFileListDrop(draggedFileId, targetFileId);
        }
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
            onOpenSettings={() => setShowSettingsModal(true)}
            onSearch={(query, global) => {
              setSearchQuery(query);
              setSearchGlobal(global);
            }}
            onWorkspaceContextMenu={handleWorkspaceContextMenu}
            activeFileContent={openTabs.find(t => t.id === activeFileId)?.content}
            activeFileExtension={openTabs.find(t => t.id === activeFileId)?.extension}
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
              absolutePath: f.absolutePath,
              modifiedAt: f.modifiedAt,
              isFavorite: f.isFavorite,
              size: f.size,
            }))}
            sortMode={sortMode}
            activeFileId={activeFileId}
            onSortChange={setSortMode}
            onFileSelect={handleFileSelect}
            onToggleFavorite={handleToggleFavorite}
            onDeleteFile={handleDeleteFile}
            onCopyFile={handleCopyFile}
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
            onNewFile={() => setShowNewFileModal(true)}
            onOpenSettings={() => setShowSettingsModal(true)}
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
      {/* Rename File Modal */}
      {renameFileTarget && (
        <RenameModal
          title="Rename File"
          description="Enter a new name for the file."
          initialName={renameFileTarget.name}
          onClose={() => setRenameFileTarget(null)}
          onSubmit={handleRenameFile}
        />
      )}

      {/* Rename Workspace Modal */}
      {renameWorkspaceTarget && (
        <RenameModal
          title="Rename Workspace"
          description="Enter a new name for the workspace folder. This will rename the folder on your disk."
          initialName={renameWorkspaceTarget.name}
          onClose={() => setRenameWorkspaceTarget(null)}
          onSubmit={handleRenameWorkspace}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onRemoveAllWorkspaces={handleRemoveAllWorkspaces}
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
      {toastMessage && (
        <div className="app-toast">
          {toastMessage}
        </div>
      )}
    </DndContext>
  );
}

export default App;
