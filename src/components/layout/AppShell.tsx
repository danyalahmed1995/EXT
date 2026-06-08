import React, { useState, useCallback, useRef, useEffect } from 'react';
import './AppShell.css';

// ── Types ────────────────────────────────────────────

interface AppShellProps {
  sidebar: React.ReactNode;
  fileList: React.ReactNode;
  editor: React.ReactNode;
  isSidebarVisible?: boolean;
}

// ── ResizeHandle Component ──────────────────────────

interface ResizeHandleProps {
  onDrag: (deltaX: number) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onDrag }) => {
  const [dragging, setDragging] = useState(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    lastX.current = e.clientX;
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onDrag]);

  return (
    <div
      className={`resize-handle ${dragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
    />
  );
};

// ── AppShell Component ──────────────────────────────

export const AppShell: React.FC<AppShellProps> = ({
  sidebar,
  fileList,
  editor,
  isSidebarVisible = true,
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [fileListWidth, setFileListWidth] = useState(300);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(160, Math.min(400, w + delta)));
  }, []);

  const handleFileListResize = useCallback((delta: number) => {
    setFileListWidth((w) => Math.max(200, Math.min(500, w + delta)));
  }, []);

  return (
    <div className="app-shell">
      {isSidebarVisible && (
        <>
          <div className="pane-sidebar" style={{ width: sidebarWidth }}>
            {sidebar}
          </div>
          <ResizeHandle onDrag={handleSidebarResize} />
        </>
      )}
      <div className="pane-filelist" style={{ width: fileListWidth }}>
        {fileList}
      </div>
      <ResizeHandle onDrag={handleFileListResize} />
      <div className="pane-editor">
        {editor}
      </div>
    </div>
  );
};
