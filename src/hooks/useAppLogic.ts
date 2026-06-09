import { useState, useCallback, useEffect, useMemo, useRef, startTransition } from 'react';
import { ViewMode, EditorTab } from '../components/editor/EditorPanel';
import { ContextMenuItem } from '../components/context-menu/ContextMenu';
import { Workspace, FileItem, SortMode, AppearanceSettings } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { convertLineEndings, detectLineEnding, prepareContentForSave, type ConvertibleLineEnding } from '../utils/lineEndings';
import { safeListen } from '../utils/tauriEvents';

export function useAppLogic() {

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
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set());
  
  const defaultIgnoredDirs = [
    ".git",
    "node_modules",
    "dist",
    "build",
    "target",
    ".next",
    "out",
    "coverage",
    "vendor",
    "Library",
    "Temp",
    "tmp",
    ".cache",
    ".turbo",
    ".venv",
    "venv",
    "bin",
    "obj",
  ];

  // Settings State
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    animations: true,
    premiumEffects: true,
    smoothTabs: true,
    sidebarHover: true,
    editorFocus: true,
    previewTransitions: true,
    reduceMotion: false,
    ignoredDirs: defaultIgnoredDirs,
    enableProfiler: false,
    previewCentered: false,
  });

  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGlobal, setSearchGlobal] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [renameFileTarget, setRenameFileTarget] = useState<{ id: string, name: string } | null>(null);
  const [renameWorkspaceTarget, setRenameWorkspaceTarget] = useState<{ id: string, name: string, path: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const pendingOpenFileIds = useRef<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const readActiveEditorContent = useCallback((tabId: string, fallback: string) => {
    if (tabId !== activeFileId) return fallback;
    const event = new CustomEvent<{ content?: string }>('editor-read-active-content', {
      detail: {},
    });
    window.dispatchEvent(event);
    return event.detail.content ?? fallback;
  }, [activeFileId]);

  // ── Initialization (Load Persistence) ───────────────

  useEffect(() => {
    async function loadData() {
      setIsScanning(true);
      try {
        let storedWorkspaces: Workspace[] = JSON.parse(localStorage.getItem('ext_workspaces') || '[]');
        
        if (import.meta.env.DEV && storedWorkspaces.length === 0) {
          let examplesPath = '';
          try {
            examplesPath = await invoke<string>('initialize_example_workspace');
          } catch (err) {
            console.error('Failed to resolve example workspace:', err);
          }

          // Keep the sample workspace handy in development without shipping it in production.
          if (examplesPath) {
            const newWorkspace: Workspace = {
              id: `ws-${Date.now()}`,
              name: 'Examples',
              path: examplesPath,
              detectedIcon: 'markdown'
            };
            storedWorkspaces.push(newWorkspace);
            localStorage.setItem('ext_workspaces', JSON.stringify(storedWorkspaces));
          }
        }
        
        const storedFavorites: string[] = JSON.parse(localStorage.getItem('ext_favorites') || '[]');
        const storedSortMode: SortMode = (localStorage.getItem('ext_sortMode') as SortMode) || 'date-desc';
        const storedCustomOrder: Record<string, string[]> = JSON.parse(localStorage.getItem('ext_customOrder') || '{}');
        
        const defaultAppearance: AppearanceSettings = {
          animations: true,
          premiumEffects: true,
          smoothTabs: true,
          sidebarHover: true,
          editorFocus: true,
          previewTransitions: true,
          reduceMotion: window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
          ignoredDirs: defaultIgnoredDirs,
          enableProfiler: false,
          previewCentered: false,
        };
        const storedAppearance: AppearanceSettings = JSON.parse(localStorage.getItem('ext_appearance') || 'null') || defaultAppearance;
        if (!storedAppearance.ignoredDirs || !Array.isArray(storedAppearance.ignoredDirs)) {
          storedAppearance.ignoredDirs = defaultIgnoredDirs;
        }
        
        setWorkspaces(storedWorkspaces);
        setSortMode(storedSortMode);
        setCustomFileOrder(storedCustomOrder);
        setAppearance(storedAppearance);
        
        let allFiles: FileItem[] = [];
        
        // Scan all stored workspaces concurrently
        await Promise.all(
          storedWorkspaces.map(async (ws) => {
            try {
              const result: { files: FileItem[], detectedIcon: string } = await invoke('scan_directory', {
                path: ws.path,
                workspaceId: ws.id,
                workspaceName: ws.name,
                ignoredDirs: appearanceRef.current.ignoredDirs,
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
          const workspace = storedWorkspaces.find(w => w.id === first.workspaceId);
          
          let content = '';
          if (workspace) {
            try {
              content = await invoke<string>('read_file', { workspacePath: workspace.path, relativePath: first.relativePath });
            } catch (e) {
              console.error('Failed to read initial file content:', e);
            }
          }

          setActiveFileId(first.id);
          setOpenTabs([{
            id: first.id,
            name: first.name,
            extension: first.extension,
            content,
            isDirty: false,
            absolutePath: first.absolutePath,
            lineEnding: detectLineEnding(content),
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

  // Sync appearance settings
  useEffect(() => {
    if (!isScanning) {
      localStorage.setItem('ext_appearance', JSON.stringify(appearance));
    }
  }, [appearance, isScanning]);

  // ── Smart view counts (dynamic) ───────────────────

  const smartViewCounts = useMemo(() => {
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
          f.hasTodos
      ).length,
    };
  }, [files]);

  // ── View Filtering ────────────────────────────────

  const filteredFiles = useMemo(() => {
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
        result = result.filter((f) => f.isFavorite);
        break;
      case 'allMarkdown':
        result = result.filter((f) => f.extension === '.md' || f.extension === '.markdown');
        break;
      case 'allText':
        result = result.filter((f) => f.extension === '.txt');
        break;
      case 'modifiedToday': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        result = result.filter((f) => new Date(f.modifiedAt) >= today);
        break;
      }
      case 'todos':
        result = result.filter(
          (f) =>
            f.hasTodos
        );
        break;
      default:
        if (activeView.startsWith('ws-')) {
          const wsId = activeView.replace('ws-', '');
          result = result.filter((f) => f.workspaceId === wsId);
        }
        break;
    }

    // Apply Sorting (ensure we don't mutate state directly)
    if (result === files) {
      result = [...result];
    }
    
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

  const filesById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const workspacesById = useMemo(() => new Map(workspaces.map((workspace) => [workspace.id, workspace])), [workspaces]);

  const viewTitle = useMemo(() => {
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

  // Clear selections when view changes
  useEffect(() => {
    setSelectedFiles(new Set());
    setContextMenu(null);
  }, [activeView, searchQuery, sortMode]);

  // ── Selection Handlers ────────────────────────────

  const handleToggleFileSelection = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const handleToggleWorkspaceSelection = useCallback((workspaceId: string) => {
    setSelectedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  }, []);

  // ── File Handlers ─────────────────────────────────

  const handleFileSelect = useCallback(
    (fileId: string) => {
      const alreadyOpen = openTabs.some((t) => t.id === fileId);
      if (activeFileId === fileId && alreadyOpen) {
        setContextMenu((prev) => (prev === null ? prev : null));
        return;
      }

      setContextMenu((prev) => (prev === null ? prev : null));
      setActiveFileId((prev) => (prev === fileId ? prev : fileId));

      if (alreadyOpen || pendingOpenFileIds.current.has(fileId)) return;

      const file = filesById.get(fileId);
      const workspace = file ? workspacesById.get(file.workspaceId) : undefined;
      if (!file || !workspace) return;

      pendingOpenFileIds.current.add(fileId);

      // Instantly insert a loading tab so the UI doesn't jump to empty.
      setOpenTabs((tabs) => {
        if (tabs.some((t) => t.id === fileId)) return tabs;
        return [
          ...tabs,
          {
            id: file.id,
            name: file.name,
            extension: file.extension,
            content: '',
            isDirty: false,
            absolutePath: file.absolutePath,
            lineEnding: 'LF',
            isLoading: true
          },
        ];
      });

      invoke<string>('read_file', { workspacePath: workspace.path, relativePath: file.relativePath }).then((content) => {
        // Update the tab with the real content and stop loading spinner.
        startTransition(() => {
          setOpenTabs((tabs) => tabs.map(t => t.id === fileId ? { ...t, content: content || '', lineEnding: detectLineEnding(content || ''), isLoading: false } : t));
        });
      }).catch(() => {
        startTransition(() => {
          setOpenTabs((tabs) => tabs.map(t => t.id === fileId ? { ...t, content: '', isLoading: false } : t));
        });
      }).finally(() => {
        pendingOpenFileIds.current.delete(fileId);
      });
    },
    [activeFileId, openTabs, filesById, workspacesById]
  );

  const handleTabClose = useCallback(
    (tabId: string) => {
      const index = openTabs.findIndex(t => t.id === tabId);
      if (index === -1) return;
      
      if (activeFileId === tabId) {
        if (openTabs.length === 1) {
          setActiveFileId(null);
        } else if (index === 0) {
          setActiveFileId(openTabs[1].id); // Shift right if it's the first tab
        } else {
          setActiveFileId(openTabs[index - 1].id); // Shift left otherwise
        }
      }
      setOpenTabs((tabs) => tabs.filter((t) => t.id !== tabId));
    },
    [activeFileId, openTabs]
  );

  const handleReloadTab = useCallback(async (tabId: string) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      const confirmed = await ask('This file has unsaved changes. Reloading will discard them. Continue?', {
        title: 'Unsaved Changes',
        kind: 'warning',
        okLabel: 'Reload Anyway',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
    }

    const file = files.find(f => f.id === tabId);
    const workspace = workspaces.find(w => w.id === file?.workspaceId);
    if (file && workspace) {
      try {
        const content = await invoke<string>('read_file', { workspacePath: workspace.path, relativePath: file.relativePath });
        setOpenTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, content, lineEnding: detectLineEnding(content), isDirty: false } : t));
        showToast('File reloaded');
      } catch (e) {
        showToast('Failed to reload file');
      }
    }
  }, [openTabs, files, workspaces]);

  const handleClearOtherTabs = useCallback(async (tabId: string) => {
    const hasDirtyOthers = openTabs.some(t => t.id !== tabId && t.isDirty);
    if (hasDirtyOthers) {
      const confirmed = await ask('Other tabs have unsaved changes. Closing them will discard changes. Continue?', {
        title: 'Unsaved Changes',
        kind: 'warning',
        okLabel: 'Close Anyway',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
    }

    setOpenTabs(tabs => tabs.filter(t => t.id === tabId));
    setActiveFileId(tabId);
  }, [openTabs]);

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
        ignoredDirs: appearanceRef.current.ignoredDirs,
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
        ignoredDirs: appearanceRef.current.ignoredDirs,
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
    const unlistenDragDrop = safeListen<any>('tauri://drag-drop', (event) => {
      const paths = event.payload?.paths;
      if (Array.isArray(paths)) {
        paths.forEach(p => handleAddFolderByPath(p));
      }
    });

    const unlistenFileDrop = safeListen<any>('tauri://file-drop', (event) => {
      const paths = event.payload;
      if (Array.isArray(paths)) {
        paths.forEach(p => handleAddFolderByPath(p));
      }
    });

    return () => {
      unlistenDragDrop();
      unlistenFileDrop();
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

  // ── Bulk Remove Workspaces Handler ───────────────────

  const handleBulkRemoveWorkspaces = useCallback(async () => {
    if (selectedWorkspaces.size === 0) return;

    const confirmed = await ask(`Are you sure you want to remove ${selectedWorkspaces.size} workspaces? Your files will remain safe on disk.`, {
      title: 'Confirm Bulk Removal',
      kind: 'warning',
    });

    if (!confirmed) return;

    try {
      setWorkspaces((prev) => prev.filter((w) => !selectedWorkspaces.has(w.id)));
      setFiles((prev) => prev.filter((f) => !selectedWorkspaces.has(f.workspaceId)));
      
      const activeFile = files.find(f => f.id === activeFileId);
      if (activeFile && selectedWorkspaces.has(activeFile.workspaceId)) {
        setActiveFileId(null);
        setOpenTabs([]);
      }
      
      if (activeView.startsWith('ws-')) {
        const wsId = activeView.replace('ws-', '');
        if (selectedWorkspaces.has(wsId)) {
          setActiveView('allMarkdown');
        }
      }
      setSelectedWorkspaces(new Set());
      showToast(`Removed ${selectedWorkspaces.size} workspaces`);
    } catch (err) {
      console.error('Failed to remove workspaces:', err);
    }
  }, [selectedWorkspaces, workspaces, files, activeFileId, activeView]);

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
          content: '',
          isDirty: false,
          saveStatus: 'saved',
          absolutePath: newFile.absolutePath,
          lineEnding: 'LF',
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

      const newId = `${ws.id}-${renamedFile.relativePath.replace(/\\/g, '/')}`;
      renamedFile.id = newId;
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

    if (!tab || !file || !workspace) return;
    const latestContent = readActiveEditorContent(tab.id, tab.content);
    if (!tab.isDirty && latestContent === tab.content) return;

    setOpenTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, saveStatus: 'saving' } : t)));

    try {
      const modifiedAt = await invoke('save_file', {
        workspacePath: workspace.path,
        relativePath: file.relativePath,
        content: prepareContentForSave(latestContent, tab.lineEnding),
      });

      // Update file list modified date
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, modifiedAt: modifiedAt as string, content: latestContent } : f
        )
      );

      // Clear dirty flag
      setOpenTabs((prev) =>
        prev.map((t) => (t.id === tab.id ? { ...t, content: latestContent, isDirty: false, saveStatus: 'saved' } : t))
      );
    } catch (err) {
      console.error('Failed to save file:', err);
      setOpenTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, saveStatus: 'error' } : t)));
      showToast(`Failed to save file: ${err}`);
    }
  }, [openTabs, files, workspaces, readActiveEditorContent]);

  const handleConvertLineEnding = useCallback((tabId: string, target: ConvertibleLineEnding) => {
    setOpenTabs((tabs) =>
      tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        const latestContent = readActiveEditorContent(tab.id, tab.content);
        return {
          ...tab,
          content: convertLineEndings(latestContent, target),
          lineEnding: target,
          isDirty: true,
          saveStatus: 'unsaved',
        };
      })
    );
  }, [readActiveEditorContent]);

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
      if (openTabs.some(t => t.id === fileId)) {
        handleTabClose(fileId);
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
      alert(`Failed to delete file: ${err}`);
    }
  }, [files, workspaces, activeFileId, openTabs, handleTabClose]);

  // ── Bulk Delete Files Handler ───────────────────────

  const handleBulkDeleteFiles = useCallback(async () => {
    if (selectedFiles.size === 0) return;

    const confirmed = await ask(`Are you sure you want to delete ${selectedFiles.size} files? This action cannot be undone.`, {
      title: 'Confirm Bulk Deletion',
      kind: 'warning',
    });

    if (!confirmed) return;

    try {
      for (const fileId of selectedFiles) {
        const file = files.find(f => f.id === fileId);
        const workspace = workspaces.find(w => w.id === file?.workspaceId);
        
        if (file && workspace) {
          await invoke('delete_file', {
            workspacePath: workspace.path,
            relativePath: file.relativePath,
          });
        }
      }

      setFiles((prev) => prev.filter((f) => !selectedFiles.has(f.id)));
      
      // Close tabs if open
      for (const fileId of selectedFiles) {
        if (openTabs.some(t => t.id === fileId)) {
          handleTabClose(fileId);
        }
      }
      
      setSelectedFiles(new Set());
      showToast(`Deleted ${selectedFiles.size} files`);
    } catch (err) {
      console.error('Failed to bulk delete files:', err);
      showToast(`Failed to delete files: ${err}`);
    }
  }, [selectedFiles, files, workspaces, activeFileId, openTabs, handleTabClose]);

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

  // ── Open in Default App Handler ─────────────────────

  const handleOpenInDefaultApp = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file || !file.absolutePath) {
      showToast('File not found or invalid');
      return;
    }

    try {
      await openPath(file.absolutePath);
    } catch (err) {
      console.error('Failed to open file in default app:', err);
      showToast(`Failed to open file in default app: ${err instanceof Error ? err.message : String(err)}`);
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
          {
            label: 'Open in Default App',
            onClick: () => handleOpenInDefaultApp(tabId),
          },
          {
            label: 'Copy',
            shortcut: 'Ctrl+C',
            onClick: () => window.dispatchEvent(new Event('editor-copy')),
          },
          {
            label: 'Reload',
            shortcut: '',
            onClick: () => handleReloadTab(tabId),
          },
          {
            label: 'Refresh',
            shortcut: '',
            onClick: () => setPreviewKey(k => k + 1),
          },
          {
            label: 'Clear tabs',
            shortcut: '',
            onClick: () => handleClearOtherTabs(tabId),
          },
          {
            label: 'Delete',
            shortcut: 'Del',
            onClick: () => window.dispatchEvent(new Event('editor-delete')),
          },
        ],
      });
    };

    window.addEventListener('editor-context-menu', handleEditorContextMenu);
    return () => window.removeEventListener('editor-context-menu', handleEditorContextMenu);
  }, [handleSaveFile, handleOpenInDefaultApp, handleReloadTab, handleClearOtherTabs]);

  useEffect(() => {
    const handleTabBarContextMenu = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { x, y, clickedTabId, activeTabId } = customEvent.detail;
      const targetTabId = clickedTabId || activeTabId;
      if (!targetTabId) return;

      setContextMenu({
        x,
        y,
        items: [
          {
            label: 'Open in Default App',
            onClick: () => handleOpenInDefaultApp(targetTabId),
          },
          {
            label: 'Reload',
            shortcut: '',
            onClick: () => handleReloadTab(targetTabId),
          },
          {
            label: 'Refresh',
            shortcut: '',
            onClick: () => setPreviewKey(k => k + 1),
          },
          {
            label: 'Clear tabs',
            shortcut: '',
            onClick: () => handleClearOtherTabs(targetTabId),
          },
        ],
      });
    };
    window.addEventListener('tab-bar-context-menu', handleTabBarContextMenu);
    return () => window.removeEventListener('tab-bar-context-menu', handleTabBarContextMenu);
  }, [handleOpenInDefaultApp, handleReloadTab, handleClearOtherTabs]);

  // ── Keyboard Shortcuts ─────────────────────────────────

  useEffect(() => {
    const focusEditorPane = () => {
      window.dispatchEvent(new Event('editor-focus-active'));
    };

    const focusPreviewPane = () => {
      const preview = document.querySelector<HTMLElement>('.markdown-preview');
      if (!preview) return;
      if (!preview.hasAttribute('tabindex')) preview.tabIndex = -1;
      preview.focus({ preventScroll: true });
    };

    const selectAdjacentTab = (direction: 1 | -1) => {
      if (openTabs.length < 2 || !activeFileId) return;
      const currentIndex = openTabs.findIndex((tab) => tab.id === activeFileId);
      if (currentIndex === -1) return;
      const nextIndex = (currentIndex + direction + openTabs.length) % openTabs.length;
      setActiveFileId(openTabs[nextIndex].id);
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        const key = e.key.toLowerCase();

        if (key === 's') {
          e.preventDefault();
          if (activeFileId) handleSaveFile(activeFileId);
        } else if (key === 'n' && !e.shiftKey) {
          e.preventDefault();
          setShowNewFileModal(true);
        } else if (key === 'n' && e.shiftKey) {
          e.preventDefault();
          // Prompt for folder in currently active workspace (or first workspace if none)
          const wsId = activeView.startsWith('ws-') ? activeView.replace('ws-', '') : workspaces[0]?.id;
          if (wsId) {
            handleCreateFolder(wsId);
          }
        } else if (key === 'p') {
          e.preventDefault();
          document.getElementById('global-search-input')?.focus();
        } else if (key === '1') {
          e.preventDefault();
          focusEditorPane();
        } else if (key === '2') {
          e.preventDefault();
          focusPreviewPane();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          selectAdjacentTab(e.shiftKey ? -1 : 1);
        } else if (key === 'w') {
          e.preventDefault();
          if (activeFileId) handleTabClose(activeFileId);
        }
      } else if (e.key === 'F2') {
        if (activeFileId) {
          openRenameFileModal(activeFileId);
        } else if (activeView.startsWith('ws-')) {
          openRenameWorkspaceModal(activeView.replace('ws-', ''));
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Do not intercept if user is typing
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).closest('.cm-editor') || (e.target as HTMLElement).closest('[contenteditable="true"]')) {
          return;
        }
        
        if (openTabs.length > 0 && activeFileId) {
          const idx = openTabs.findIndex(t => t.id === activeFileId);
          if (e.key === 'ArrowLeft' && idx > 0) {
            e.preventDefault();
            setActiveFileId(openTabs[idx - 1].id);
          } else if (e.key === 'ArrowRight' && idx < openTabs.length - 1) {
            e.preventDefault();
            setActiveFileId(openTabs[idx + 1].id);
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeFileId, handleSaveFile, activeView, workspaces, handleCreateFolder, openTabs, handleTabClose]);

  // ── External File Change Detection ──────────────────────

  const handleWindowFocus = useCallback(async () => {
    // 1. Rescan all workspaces to update the file explorer
    try {
      let scannedFiles: FileItem[] = [];
      const storedFavs: string[] = JSON.parse(localStorage.getItem('ext_favorites') || '[]');
      
      await Promise.all(
        workspaces.map(async (ws) => {
          try {
            const result: { files: FileItem[], detectedIcon: string } = await invoke('scan_directory', {
              path: ws.path,
              workspaceId: ws.id,
              workspaceName: ws.name,
              ignoredDirs: appearanceRef.current.ignoredDirs,
            });            const scannedWithFavs = result.files.map(f => ({
              ...f,
              isFavorite: storedFavs.includes(f.id) || storedFavs.includes(f.relativePath),
            }));
            scannedFiles = scannedFiles.concat(scannedWithFavs);
          } catch (err) {
            console.error(`Failed to scan workspace ${ws.name} on focus:`, err);
          }
        })
      );
      
      if (scannedFiles.length > 0) {
        setFiles(scannedFiles);
        
        // Close tabs for files that no longer exist on disk
        const scannedIds = new Set(scannedFiles.map(f => f.id));
        for (const tab of openTabs) {
          if (!scannedIds.has(tab.id)) {
            handleTabClose(tab.id);
          }
        }
      }
    } catch (e) {
      console.error('Error rescanning workspaces on focus', e);
    }

    // 2. Check active file for external modification
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
            setOpenTabs(prev => prev.map(t => t.id === file.id ? { ...t, content: newContent, lineEnding: detectLineEnding(newContent), isDirty: false, saveStatus: 'saved' } : t));
          } else {
            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, modifiedAt: diskModifiedTime } : f));
          }
        } else {
          const newContent = await invoke<string>('read_file', {
            workspacePath: ws.path,
            relativePath: file.relativePath
          });
          setFiles(prev => prev.map(f => f.id === file.id ? { ...f, content: newContent, modifiedAt: diskModifiedTime } : f));
          setOpenTabs(prev => prev.map(t => t.id === file.id ? { ...t, content: newContent, lineEnding: detectLineEnding(newContent) } : t));
        }
      }
    } catch (e) {
      console.error('Error checking external modification', e);
    }
  }, [activeFileId, files, openTabs, workspaces, handleTabClose]);

  useEffect(() => {
    return safeListen('tauri://focus', handleWindowFocus);
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
        { label: 'Open in Default App', onClick: () => handleOpenInDefaultApp(fileId) },
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
  }, [files, workspaces, handleDeleteFile, handleCopyFile, handleFileSelect, openRenameFileModal, handleOpenInDefaultApp]);

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
        ...(selectedWorkspaces.has(workspaceId) && selectedWorkspaces.size > 1
          ? [{ label: `Remove Selected Workspaces (${selectedWorkspaces.size})`, onClick: handleBulkRemoveWorkspaces }]
          : [{ label: 'Remove Workspace', onClick: () => handleRemoveWorkspace(workspaceId) }]),
      ]
    });
  }, [workspaces, handleCreateFolder, handleRemoveWorkspace, handleBulkRemoveWorkspaces, openRenameWorkspaceModal, selectedWorkspaces]);

  const handleFileListDrop = useCallback((draggedId: string, targetId: string) => {
    // Reorder the current filtered view
    const currentFiles = filteredFiles;
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
  }, [filteredFiles, activeView]);

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

  // ── Tray Integration ────────────────────────────────────

  useEffect(() => {
    const unlistenExit = safeListen('tray-exit-requested', async () => {
      const hasDirty = openTabs.some((t) => t.isDirty);
      if (hasDirty) {
        const confirmed = await ask('You have unsaved changes. Exiting may discard them. Continue?', {
          title: 'Unsaved Changes',
          kind: 'warning',
          okLabel: 'Exit Anyway',
          cancelLabel: 'Cancel',
        });
        if (!confirmed) return;
      }
      console.log('App quit allowed');
      invoke('force_exit');
    });

    const unlistenRestart = safeListen('tray-restart-requested', async () => {
      const hasDirty = openTabs.some((t) => t.isDirty);
      if (hasDirty) {
        const confirmed = await ask('You have unsaved changes. Restarting may discard them. Continue?', {
          title: 'Unsaved Changes',
          kind: 'warning',
          okLabel: 'Restart Anyway',
          cancelLabel: 'Cancel',
        });
        if (!confirmed) return;
      }
      console.log('App restart allowed');
      invoke('force_restart');
    });

    return () => {
      unlistenExit();
      unlistenRestart();
    };
  }, [openTabs]);


  return {
    setViewMode,
    setShowSettingsModal,
    setSearchQuery,
    setSearchGlobal,
    setShowNewFileModal,
    setRenameFileTarget,
    setRenameWorkspaceTarget,
    setAppearance,
    setContextMenu,
    setActiveView,
    setSortMode,
    setActiveFileId,
    sensors,
    handleDragEnd,
    previewKey,
    activeView,
    viewMode,
    activeFileId,
    openTabs,
    files,
    workspaces,
    isScanning,
    sortMode,
    customFileOrder,
    appearance,
    searchQuery,
    searchGlobal,
    showNewFileModal,
    showSettingsModal,
    renameFileTarget,
    renameWorkspaceTarget,
    contextMenu,
    toastMessage,
    handleFileSelect,
    handleTabClose,
    handleContentChange,
    handleTabReorder,
    handleToggleFavorite,
    handleAddFolder,
    handleAddFolderByPath,
    handleRemoveWorkspace,
    handleRemoveAllWorkspaces,
    handleCreateFile,
    handleRenameFile,
    handleRenameWorkspace,
    handleCreateFolder,
    handleMoveFile,
    handleSaveFile,
    handleConvertLineEnding,
    handleDeleteFile,
    handleCopyFile,
    handleOpenInDefaultApp,
    handleWindowFocus,
    handleFileListContextMenu,
    handleWorkspaceContextMenu,
    handleFileListDrop,
    smartViewCounts,
    filteredFiles,
    viewTitle,
    openRenameFileModal,
    openRenameWorkspaceModal,
    showToast,
    selectedFiles,
    handleToggleFileSelection,
    handleBulkDeleteFiles,
    selectedWorkspaces,
    handleToggleWorkspaceSelection,
    handleBulkRemoveWorkspaces,
  };
}
