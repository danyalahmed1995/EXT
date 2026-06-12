import { useEffect, useState, useMemo } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Sidebar } from './components/sidebar/Sidebar';
import { FileList } from './components/file-list/FileList';
import { EditorPanel } from './components/editor/EditorPanel';
import { NewFileModal } from './components/modals/NewFileModal';
import { RenameModal } from './components/modals/RenameModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { ContextMenu } from './components/context-menu/ContextMenu';
import { DndContext, pointerWithin } from '@dnd-kit/core';
import { normalizeLargeFileSettings } from './utils/largeFile';


import { useAppLogic } from './hooks/useAppLogic';
import { useIdleState } from './hooks/useIdleState';

function App() {
  useIdleState(); // Start tracking global idle state

  const [isProfiling, setIsProfiling] = useState(false);
  const [profileResults, setProfileResults] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const {
  activeView,
  setActiveView,
  viewMode,
  setViewMode,
  activeFileId,
  setActiveFileId,
  openTabs,
  workspaces,
  sortMode,
  setSortMode,
  appearance,
  setAppearance,
  setSearchQuery,
  setSearchGlobal,
  showNewFileModal,
  setShowNewFileModal,
  showSettingsModal,
  setShowSettingsModal,
  renameFileTarget,
  setRenameFileTarget,
  renameWorkspaceTarget,
  setRenameWorkspaceTarget,
  previewKey,
  contextMenu,
  setContextMenu,
  toastMessage,
  handleFileSelect,
  handleTabClose,
  handleContentChange,
  handleConvertLineEnding,
  handleToggleFavorite,
  handleAddFolder,
  handleRemoveAllWorkspaces,
  handleCreateFile,
  selectedFiles,
  handleToggleFileSelection,
  handleBulkDeleteFiles,
  selectedWorkspaces,
  handleToggleWorkspaceSelection,
  handleRenameFile,
  handleRenameWorkspace,
  handleSaveFile,
  handleLargeFileStateChange,
  handleDeleteFile,
  handleCopyFile,
  handleFileListContextMenu,
  handleWorkspaceContextMenu,
  smartViewCounts,
  filteredFiles,
  viewTitle,
  sensors,
  handleDragEnd
} = useAppLogic();

  // Memoize active file content/extension for Sidebar to prevent re-renders
  const activeTabMemo = useMemo(() => openTabs.find(t => t.id === activeFileId), [openTabs, activeFileId]);
  const activeFileContent = activeTabMemo?.isLargeFile ? undefined : activeTabMemo?.content;
  const activeFileExtension = activeTabMemo?.extension;
  const largeFileSettings = normalizeLargeFileSettings(appearance.largeFileMode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'b') return;
      e.preventDefault();
      setIsSidebarVisible((visible) => !visible);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Run Profile Automation ────────────────────────
  const runProfile = async () => {
    if (openTabs.length < 2) {
      alert("Please open at least 2 large files in tabs before running the profile.");
      return;
    }
    
    setIsProfiling(true);
    setProfileResults(null);
    let log = "=== NAVIGATION PROFILE ===\n";
    let maxDelay = 0;
    let over50Count = 0;
    let over200Count = 0;
    const longTasks: { duration: number; when: string }[] = [];

    // Track long tasks via PerformanceObserver
    let longTaskObserver: PerformanceObserver | null = null;
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push({ duration: Math.round(entry.duration), when: `t+${Math.round(entry.startTime)}ms` });
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch {
      // PerformanceObserver for longtask not supported
    }

    // Track max frame delay  
    let frameMaxDelay = 0;
    let lastFrameTime = performance.now();
    let frameRafId = 0;
    const frameLoop = () => {
      const now = performance.now();
      const delta = now - lastFrameTime;
      if (delta > frameMaxDelay) frameMaxDelay = delta;
      lastFrameTime = now;
      frameRafId = requestAnimationFrame(frameLoop);
    };
    frameRafId = requestAnimationFrame(frameLoop);

    const iterations = Math.min(50, openTabs.length * 10);
    for (let i = 0; i < iterations; i++) {
      const fileId = openTabs[i % openTabs.length].id;
      const start = performance.now();
      
      // Trigger navigation
      handleFileSelect(fileId);
      
      // Wait for React to render and browser to paint
      await new Promise(r => setTimeout(r, 0));
      await new Promise(r => requestAnimationFrame(r));
      
      const end = performance.now();
      const delay = end - start;
      maxDelay = Math.max(maxDelay, delay);
      
      if (delay > 50) over50Count++;
      if (delay > 200) over200Count++;
      if (i < 20) {
        log += `Switch ${i + 1} to ${fileId.substring(0, 8)}: ${delay.toFixed(2)}ms\n`;
      }
      
      // Let the system settle slightly to simulate rapid user clicking
      await new Promise(r => setTimeout(r, 80));
    }
    
    cancelAnimationFrame(frameRafId);
    longTaskObserver?.disconnect();
    
    log += `\n--- Summary (${iterations} switches) ---\n`;
    log += `Max switch delay: ${maxDelay.toFixed(2)}ms\n`;
    log += `Max frame delay: ${frameMaxDelay.toFixed(2)}ms\n`;
    log += `Switches > 50ms: ${over50Count}/${iterations}\n`;
    log += `Switches > 200ms: ${over200Count}/${iterations}\n`;
    log += `Long tasks (>50ms): ${longTasks.length}\n`;
    if (longTasks.length > 0) {
      log += `Worst long task: ${Math.max(...longTasks.map(t => t.duration))}ms\n`;
      longTasks.slice(0, 5).forEach((t, i) => {
        log += `  Task ${i + 1}: ${t.duration}ms at ${t.when}\n`;
      });
    }
    
    setProfileResults(log);
    setIsProfiling(false);
  };

// ── Render ────────────────────────────────────────

  return (
    <div 
      className={`app-container ${appearance.premiumEffects ? 'premium-effects' : ''} ${appearance.smoothTabs ? 'smooth-tabs' : ''}`}
      data-animations={appearance.animations}
      data-sidebar-hover={appearance.sidebarHover}
      data-editor-focus={appearance.editorFocus}
      data-preview-transitions={appearance.previewTransitions}
      data-reduce-motion={appearance.reduceMotion}
      data-preview-centered={appearance.previewCentered}
    >
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
        <AppShell
          isSidebarVisible={isSidebarVisible}
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
            activeFileContent={activeFileContent}
            activeFileExtension={activeFileExtension}
            activeFileId={activeFileId}
            selectedWorkspaces={selectedWorkspaces}
            onToggleWorkspaceSelection={handleToggleWorkspaceSelection}
          />
        }
        fileList={
          <FileList
            title={viewTitle}
            files={filteredFiles.map((f) => ({
              id: f.id,
              name: f.name,
              extension: f.extension,
              workspace: f.workspace,
              absolutePath: f.absolutePath,
              relativePath: f.relativePath,
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
            selectedFiles={selectedFiles}
            onToggleSelection={handleToggleFileSelection}
            onBulkDeleteFiles={handleBulkDeleteFiles}
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
            onLargeFileStateChange={handleLargeFileStateChange}
            onConvertLineEnding={handleConvertLineEnding}
            onSaveFile={handleSaveFile}
            onNewFile={() => setShowNewFileModal(true)}
            onOpenSettings={() => setShowSettingsModal(true)}
            previewKey={previewKey}
            showLargeFileDetails={largeFileSettings.showDetailsPanel}
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
          appearance={appearance}
          onUpdateAppearance={setAppearance}
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
      {/* Profiler UI Overlay */}
      {appearance.enableProfiler && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {openTabs.length > 1 && (
            <button 
              onClick={runProfile}
              disabled={isProfiling}
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 500,
                cursor: isProfiling ? 'wait' : 'pointer',
                opacity: isProfiling ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
            >
              {isProfiling ? 'Profiling...' : 'Run Navigation Profile'}
            </button>
          )}
          {profileResults && (
            <div style={{ background: 'rgba(0,0,0,0.9)', color: '#0f0', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto', border: '1px solid #333' }}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 10}}>
                <strong>Results:</strong>
                <button onClick={() => setProfileResults(null)} style={{background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer'}}>Close</button>
              </div>
              {profileResults}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default App;
