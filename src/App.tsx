import { AppShell } from './components/layout/AppShell';
import { Sidebar } from './components/sidebar/Sidebar';
import { FileList } from './components/file-list/FileList';
import { EditorPanel } from './components/editor/EditorPanel';
import { NewFileModal } from './components/modals/NewFileModal';
import { RenameModal } from './components/modals/RenameModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { ContextMenu } from './components/context-menu/ContextMenu';
import { DndContext, pointerWithin } from '@dnd-kit/core';


import { useAppLogic } from './hooks/useAppLogic';
import { useIdleState } from './hooks/useIdleState';

function App() {
  useIdleState(); // Start tracking global idle state

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

// ── Render ────────────────────────────────────────

  return (
    <div 
      className="app-container"
      data-animations={appearance.animations}
      data-premium-effects={appearance.premiumEffects}
      data-smooth-tabs={appearance.smoothTabs}
      data-sidebar-hover={appearance.sidebarHover}
      data-editor-focus={appearance.editorFocus}
      data-preview-transitions={appearance.previewTransitions}
      data-reduce-motion={appearance.reduceMotion}
    >
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
            onSaveFile={handleSaveFile}
            onNewFile={() => setShowNewFileModal(true)}
            onOpenSettings={() => setShowSettingsModal(true)}
            previewKey={previewKey}
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
    </div>
  );
}

export default App;

