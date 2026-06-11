import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  LargeFileChunkState,
  LargeFileMetadata,
  LargeFilePatch,
  LargeFileSearchResult,
  LargeFileSessionState,
} from '../../utils/largeFile';
import { formatBytes } from '../../utils/largeFile';
import { safeListen } from '../../utils/tauriEvents';

interface LargeFileModePanelProps {
  tabId: string;
  workspacePath?: string;
  relativePath?: string;
  metadata: LargeFileMetadata;
  state?: LargeFileSessionState;
  showDetailsPanel?: boolean;
  onStateChange?: (state: LargeFileSessionState, isDirty: boolean) => void;
}

interface FileChunkResponse {
  text: string;
  offset: number;
  endOffset: number;
  bytesRead: number;
  nextOffset: number;
  isEof: boolean;
  newlineCount: number;
  beginsMidLine: boolean;
  endsMidLine: boolean;
  newlineStyle: 'LF' | 'CRLF' | 'Mixed' | 'Unknown';
}

interface SearchChunkResult {
  matches: LargeFileSearchResult[];
  scannedBytes: number;
  linesScanned: number;
  nextOffset: number;
  isEof: boolean;
}

interface SaveResult {
  modifiedAt: string;
  size: number;
  patchCount: number;
  backupPath?: string;
}

interface SaveProgressEvent {
  requestId: string;
  writtenBytes: number;
  totalBytes: number;
  phase: string;
}

const CHUNK_BYTES = 96 * 1024;
const SEARCH_CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_VISIBLE_RESULTS = 200;
const MAX_CHUNK_CACHE_ENTRIES = 5;
const EDIT_SYNC_DEBOUNCE_MS = 350;

function createInitialState(): LargeFileSessionState {
  return {
    currentOffset: 0,
    patches: [],
    chunkCache: [],
    searchResults: [],
    scannedBytes: 0,
    status: 'Ready.',
  };
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function patchId(start: number, end: number): string {
  return `${start}-${end}`;
}

function applyPatchToChunk(chunk: LargeFileChunkState, patches: LargeFilePatch[]): LargeFileChunkState {
  const patch = patches.find((candidate) => candidate.start === chunk.offset && candidate.end === chunk.endOffset);
  return patch ? { ...chunk, text: patch.text } : chunk;
}

function updateChunkCache(cache: LargeFileChunkState[] | undefined, chunk: LargeFileChunkState): LargeFileChunkState[] {
  const cleanChunk = { ...chunk, text: chunk.originalText };
  const next = [
    cleanChunk,
    ...(cache ?? []).filter((cached) => !(cached.offset === cleanChunk.offset && cached.endOffset === cleanChunk.endOffset)),
  ];
  return next.slice(0, MAX_CHUNK_CACHE_ENTRIES);
}

function isSameChunk(a?: LargeFileChunkState, b?: LargeFileChunkState): boolean {
  return Boolean(a && b && a.offset === b.offset && a.endOffset === b.endOffset && a.loadedAt === b.loadedAt);
}

function normalizeChunkOffset(offset: number, fileSize: number): number {
  if (fileSize <= 0) return 0;
  const clamped = Math.max(0, Math.min(offset, fileSize - 1));
  return Math.floor(clamped / CHUNK_BYTES) * CHUNK_BYTES;
}

export const LargeFileModePanel: React.FC<LargeFileModePanelProps> = ({
  tabId,
  workspacePath,
  relativePath,
  metadata,
  state,
  showDetailsPanel = true,
  onStateChange,
}) => {
  const session = state ?? createInitialState();
  const [query, setQuery] = React.useState(session.searchQuery ?? '');
  const [jumpValue, setJumpValue] = React.useState('');
  const [isLoadingChunk, setIsLoadingChunk] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveProgress, setSaveProgress] = React.useState<SaveProgressEvent | null>(null);
  const cancelSearchRef = React.useRef(false);
  const cancelIndexRef = React.useRef(false);
  const loadingRef = React.useRef(0);
  const searchRef = React.useRef(0);
  const saveRequestRef = React.useRef<string | null>(null);
  const sessionRef = React.useRef(session);
  const editorRef = React.useRef<HTMLTextAreaElement | null>(null);
  const draftTextRef = React.useRef('');
  const editSyncTimerRef = React.useRef<number | null>(null);
  const lastRenderMarkRef = React.useRef<number | null>(null);
  const renderedChunkRef = React.useRef<LargeFileChunkState | undefined>(undefined);
  const lastInteractionRef = React.useRef(Date.now());

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const currentChunk = session.chunk;
  const currentText = currentChunk?.text ?? '';
  const fileSize = session.fileSize ?? metadata.size;
  const modifiedAt = session.modifiedAt ?? metadata.modifiedAt;
  const isCurrentChunkDirty = Boolean(
    currentChunk && currentChunk.text !== currentChunk.originalText,
  );
  const hasPatches = session.patches.length > 0 || isCurrentChunkDirty;
  const progressPercent = fileSize > 0 ? Math.min(100, (session.currentOffset / fileSize) * 100) : 0;

  const emitState = React.useCallback((next: LargeFileSessionState, dirty = next.patches.length > 0) => {
    onStateChange?.(next, dirty);
  }, [onStateChange]);

  const withPreservedCurrentPatch = React.useCallback((base: LargeFileSessionState): LargeFileSessionState => {
    const chunk = base.chunk;
    if (!chunk || chunk.text === chunk.originalText) return base;

    const nextPatch: LargeFilePatch = {
      id: patchId(chunk.offset, chunk.endOffset),
      start: chunk.offset,
      end: chunk.endOffset,
      text: chunk.text,
      createdAt: Date.now(),
    };

    const patches = [
      ...base.patches.filter((patch) => patch.id !== nextPatch.id),
      nextPatch,
    ].sort((a, b) => a.start - b.start);

    return { ...base, patches };
  }, []);

  const getStateWithEditorDraft = React.useCallback((baseState = sessionRef.current): LargeFileSessionState => {
    const chunk = baseState.chunk;
    if (!chunk) return baseState;
    const draftText = draftTextRef.current;
    if (draftText === chunk.text) return withPreservedCurrentPatch(baseState);
    return withPreservedCurrentPatch({
      ...baseState,
      chunk: {
        ...chunk,
        text: draftText,
      },
    });
  }, [withPreservedCurrentPatch]);

  const flushEditorDraft = React.useCallback((status = 'Unsaved changes.') => {
    const nextState = getStateWithEditorDraft();
    const dirty = nextState.patches.length > 0 || Boolean(nextState.chunk && nextState.chunk.text !== nextState.chunk.originalText);
    emitState({ ...nextState, status }, dirty);
    return nextState;
  }, [emitState, getStateWithEditorDraft]);

  const flushPendingEditorDraft = React.useCallback((status = 'Unsaved changes.') => {
    const currentState = sessionRef.current;
    const chunk = currentState.chunk;
    if (!chunk) return currentState;
    if (draftTextRef.current === chunk.text && chunk.text === chunk.originalText) return currentState;
    return flushEditorDraft(status);
  }, [flushEditorDraft]);

  const scheduleEditorDraftSync = React.useCallback(() => {
    if (editSyncTimerRef.current != null) {
      window.clearTimeout(editSyncTimerRef.current);
    }
    editSyncTimerRef.current = window.setTimeout(() => {
      editSyncTimerRef.current = null;
      flushEditorDraft();
    }, EDIT_SYNC_DEBOUNCE_MS);
  }, [flushEditorDraft]);

  const loadChunk = React.useCallback(async (offset: number, baseState = sessionRef.current) => {
    if (!workspacePath || !relativePath) return;

    const requestId = ++loadingRef.current;
    const activeFileSize = baseState.fileSize ?? sessionRef.current.fileSize ?? metadata.size;
    const safeOffset = normalizeChunkOffset(offset, activeFileSize);
    const startedAt = performance.now();
    setIsLoadingChunk(true);

    try {
      const preserved = getStateWithEditorDraft(baseState);
      const cachedChunk = preserved.chunkCache?.find((cached) => cached.offset === safeOffset);
      if (cachedChunk) {
        const patchedChunk = applyPatchToChunk(cachedChunk, preserved.patches);
        lastRenderMarkRef.current = performance.now();
        emitState({
          ...preserved,
          currentOffset: patchedChunk.offset,
          chunk: patchedChunk,
          status: 'Ready.',
        }, preserved.patches.length > 0);
        console.log(
          `[LargeFile] chunk cache hit tab=${tabId} offset=${patchedChunk.offset} cache=${preserved.chunkCache?.length ?? 0}`,
        );
        return;
      }

      const chunk = await invoke<FileChunkResponse>('read_file_chunk', {
        workspacePath,
        relativePath,
        offset: safeOffset,
        maxBytes: CHUNK_BYTES,
      });
      if (requestId !== loadingRef.current) return;

      const existingPatch = preserved.patches.find((patch) => patch.start === chunk.offset && patch.end === chunk.endOffset);
      const chunkState: LargeFileChunkState = {
        text: existingPatch?.text ?? chunk.text,
        originalText: chunk.text,
        offset: chunk.offset,
        endOffset: chunk.endOffset,
        bytesRead: chunk.bytesRead,
        nextOffset: chunk.nextOffset,
        isEof: chunk.isEof,
        beginsMidLine: chunk.beginsMidLine,
        endsMidLine: chunk.endsMidLine,
        newlineStyle: chunk.newlineStyle,
        loadedAt: Date.now(),
      };

      console.log(
        `[LargeFile] chunk read tab=${tabId} offset=${chunk.offset} bytes=${chunk.bytesRead} elapsed_ms=${(performance.now() - startedAt).toFixed(1)} cache=${preserved.chunkCache?.length ?? 0}`,
      );

      lastRenderMarkRef.current = performance.now();
      emitState({
        ...preserved,
        currentOffset: chunk.offset,
        chunk: chunkState,
        chunkCache: updateChunkCache(preserved.chunkCache, { ...chunkState, text: chunk.text, originalText: chunk.text }),
        status: 'Ready.',
      }, preserved.patches.length > 0);
    } catch (err) {
      console.error('[LargeFile] chunk load failed:', err);
      emitState({ ...baseState, status: `Chunk load failed: ${err}` }, baseState.patches.length > 0);
    } finally {
      if (requestId === loadingRef.current) setIsLoadingChunk(false);
    }
  }, [emitState, getStateWithEditorDraft, metadata.size, relativePath, tabId, workspacePath]);

  React.useEffect(() => {
    if (!session.chunk && !isLoadingChunk) {
      loadChunk(session.currentOffset || 0, session);
    }
  }, [isLoadingChunk, loadChunk, session]);

  React.useLayoutEffect(() => {
    if (!currentChunk) return;
    const isNewWindow = !isSameChunk(renderedChunkRef.current, currentChunk);
    draftTextRef.current = currentChunk.text;
    if (isNewWindow && editorRef.current && editorRef.current.value !== currentChunk.text) {
      editorRef.current.value = currentChunk.text;
    }
    renderedChunkRef.current = currentChunk;
    if (lastRenderMarkRef.current != null) {
      const renderStartedAt = lastRenderMarkRef.current;
      window.requestAnimationFrame(() => {
        console.log(
          `[LargeFile] window paint tab=${tabId} offset=${currentChunk.offset} bytes=${currentChunk.bytesRead} render_ms=${(performance.now() - renderStartedAt).toFixed(1)} cache=${session.chunkCache?.length ?? 0} patches=${session.patches.length}`,
        );
      });
      lastRenderMarkRef.current = null;
    }
  }, [currentChunk, session.chunkCache?.length, session.patches.length, tabId]);

  React.useEffect(() => {
    const unlistenSaveProgress = safeListen<SaveProgressEvent>('large-file-save-progress', (event) => {
      const payload = event.payload;
      if (payload.requestId === saveRequestRef.current) {
        setSaveProgress(payload);
      }
    });

    return () => {
      unlistenSaveProgress();
      if (editSyncTimerRef.current != null) {
        window.clearTimeout(editSyncTimerRef.current);
        editSyncTimerRef.current = null;
      }
      flushPendingEditorDraft('Chunk edit preserved.');
      cancelSearchRef.current = true;
      cancelIndexRef.current = true;
    };
  }, [tabId]);

  React.useEffect(() => {
    if (!workspacePath || !relativePath || session.lineIndex?.isComplete || session.lineIndex?.isIndexing) return;

    cancelIndexRef.current = false;
    const startedAt = performance.now();
    const checkpointEveryBytes = 16 * 1024 * 1024;
    const indexChunkBytes = 4 * 1024 * 1024;

    const runIndex = async () => {
      let offset = session.lineIndex?.indexedBytes ?? 0;
      const existingCheckpoints = session.lineIndex?.checkpoints ?? [];
      let line = existingCheckpoints.length > 0 ? existingCheckpoints[existingCheckpoints.length - 1].line : 1;
      let nextCheckpointAt = offset + checkpointEveryBytes;
      const checkpoints = [...(existingCheckpoints.length > 0 ? existingCheckpoints : [{ line: 1, offset: 0 }])];

      emitState({
        ...sessionRef.current,
        lineIndex: {
          checkpoints,
          indexedBytes: offset,
          isComplete: false,
          isIndexing: true,
        },
      }, sessionRef.current.patches.length > 0);

      try {
        while (!cancelIndexRef.current) {
          if (Date.now() - lastInteractionRef.current < 650) {
            await new Promise((resolve) => window.setTimeout(resolve, 160));
            continue;
          }

          const chunkStartedAt = performance.now();
          const chunk = await invoke<FileChunkResponse>('read_file_chunk', {
            workspacePath,
            relativePath,
            offset,
            maxBytes: indexChunkBytes,
          });
          line += chunk.newlineCount;
          offset = chunk.nextOffset;

          if (offset >= nextCheckpointAt || chunk.isEof) {
            checkpoints.push({ line, offset });
            nextCheckpointAt = offset + checkpointEveryBytes;
            emitState({
              ...sessionRef.current,
              lineIndex: {
                checkpoints: [...checkpoints],
                indexedBytes: offset,
                totalLines: chunk.isEof ? line : undefined,
                isComplete: chunk.isEof,
                isIndexing: !chunk.isEof,
              },
            }, sessionRef.current.patches.length > 0);
            console.log(
              `[LargeFile] index progress tab=${tabId} bytes=${offset} lines=${line} chunk_ms=${(performance.now() - chunkStartedAt).toFixed(1)}`,
            );
          }

          if (chunk.isEof) {
            console.log(`[LargeFile] index complete tab=${tabId} bytes=${offset} lines=${line} elapsed_ms=${(performance.now() - startedAt).toFixed(1)}`);
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      } catch (err) {
        console.error('[LargeFile] index failed:', err);
        emitState({
          ...sessionRef.current,
          lineIndex: {
            checkpoints,
            indexedBytes: offset,
            isComplete: false,
            isIndexing: false,
          },
          status: `Index failed: ${err}`,
        }, sessionRef.current.patches.length > 0);
      }
    };

    runIndex();
    return () => {
      cancelIndexRef.current = true;
      const index = sessionRef.current.lineIndex;
      if (index?.isIndexing) {
        emitState({
          ...sessionRef.current,
          lineIndex: {
            ...index,
            isIndexing: false,
          },
        }, sessionRef.current.patches.length > 0);
      }
    };
  }, [relativePath, tabId, workspacePath]); // Keep index task alive across tab-state updates.

  const updateCurrentText = (text: string) => {
    if (!currentChunk) return;
    lastInteractionRef.current = Date.now();
    draftTextRef.current = text;
    scheduleEditorDraftSync();
  };

  const jumpToOffset = (offset: number) => {
    lastInteractionRef.current = Date.now();
    const base = flushEditorDraft('Navigating...');
    loadChunk(offset, base);
  };

  const jumpToPercent = () => {
    const trimmed = jumpValue.trim();
    if (!trimmed) return;
    if (trimmed.endsWith('%')) {
      const percent = Number(trimmed.slice(0, -1));
      if (Number.isFinite(percent)) jumpToOffset(Math.floor((Math.max(0, Math.min(100, percent)) / 100) * fileSize));
      return;
    }
    const offset = Number(trimmed);
    if (Number.isFinite(offset)) jumpToOffset(offset);
  };

  const runSearch = React.useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !workspacePath || !relativePath) return;

    cancelSearchRef.current = false;
    lastInteractionRef.current = Date.now();
    const searchId = ++searchRef.current;
    setIsSearching(true);
    let offset = 0;
    let lineOffset = 0;
    let totalScanned = 0;
    let accumulatedResults: LargeFileSearchResult[] = [];
    const startedAt = performance.now();
    const baseState = flushEditorDraft('Searching...');
    emitState({ ...baseState, searchQuery: trimmed, searchResults: [], scannedBytes: 0, status: 'Searching...' }, hasPatches);

    try {
      while (!cancelSearchRef.current) {
        const chunkStartedAt = performance.now();
        const chunk = await invoke<SearchChunkResult>('search_file_chunk', {
          workspacePath,
          relativePath,
          query: trimmed,
          offset,
          lineOffset,
          maxBytes: SEARCH_CHUNK_BYTES,
          maxResults: 50,
        });
        if (searchId !== searchRef.current) return;

        totalScanned += chunk.scannedBytes;
        offset = chunk.nextOffset;
        lineOffset += chunk.linesScanned;
        accumulatedResults = [...accumulatedResults, ...chunk.matches].slice(0, MAX_VISIBLE_RESULTS);

        emitState({
          ...sessionRef.current,
          searchQuery: trimmed,
          searchResults: accumulatedResults,
          scannedBytes: totalScanned,
          status: `Searching... ${formatBytes(totalScanned)} scanned.`,
        }, hasPatches);

        console.log(
          `[LargeFile] search chunk tab=${tabId} scanned=${chunk.scannedBytes} next=${chunk.nextOffset} results=${chunk.matches.length} elapsed_ms=${(performance.now() - chunkStartedAt).toFixed(1)}`,
        );

        if (chunk.isEof) {
          emitState({
            ...sessionRef.current,
            searchQuery: trimmed,
            searchResults: accumulatedResults,
            scannedBytes: totalScanned,
            status: `Search complete in ${(performance.now() - startedAt).toFixed(0)} ms.`,
          }, hasPatches);
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      if (cancelSearchRef.current) {
        emitState({ ...sessionRef.current, status: 'Search cancelled.' }, hasPatches);
      }
    } catch (err) {
      console.error('[LargeFile] search failed:', err);
      emitState({ ...sessionRef.current, status: `Search failed: ${err}` }, hasPatches);
    } finally {
      if (searchId === searchRef.current) setIsSearching(false);
    }
  }, [emitState, flushEditorDraft, hasPatches, query, relativePath, tabId, workspacePath]);

  const savePatches = React.useCallback(async () => {
    if (!workspacePath || !relativePath) return;
    const stateToSave = flushEditorDraft('Saving changes...');
    if (stateToSave.patches.length === 0) return;

    const startedAt = performance.now();
    const requestId = `${tabId}-${Date.now()}`;
    saveRequestRef.current = requestId;
    setIsSaving(true);
    setSaveProgress({
      requestId,
      writtenBytes: 0,
      totalBytes: fileSize,
      phase: 'Preparing',
    });
    emitState({ ...stateToSave, status: 'Saving changes...' }, true);

    try {
      const result = await invoke<SaveResult>('save_large_file_patches', {
        workspacePath,
        relativePath,
        patches: stateToSave.patches.map(({ start, end, text }) => ({ start, end, text })),
        requestId,
      });

      console.log(
        `[LargeFile] save complete tab=${tabId} patches=${result.patchCount} size=${result.size} elapsed_ms=${(performance.now() - startedAt).toFixed(1)}`,
      );
      const refreshedState: LargeFileSessionState = {
        ...stateToSave,
        currentOffset: Math.min(stateToSave.currentOffset, Math.max(0, result.size - 1)),
        fileSize: result.size,
        modifiedAt: result.modifiedAt,
        patches: [],
        chunk: undefined,
        chunkCache: [],
        searchResults: [],
        scannedBytes: 0,
        lineIndex: undefined,
        status: 'Saved changes.',
      };
      draftTextRef.current = '';
      emitState(refreshedState, false);
      void loadChunk(refreshedState.currentOffset, refreshedState);
    } catch (err) {
      console.error('[LargeFile] save failed:', err);
      emitState({ ...stateToSave, status: `Save failed: ${err}` }, true);
    } finally {
      setIsSaving(false);
      saveRequestRef.current = null;
      window.setTimeout(() => setSaveProgress(null), 700);
    }
  }, [emitState, fileSize, flushEditorDraft, loadChunk, relativePath, tabId, workspacePath]);

  React.useEffect(() => {
    const handleSaveRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ tabId?: string }>;
      if (customEvent.detail?.tabId === tabId) savePatches();
    };

    window.addEventListener('large-file-save-request', handleSaveRequest);
    return () => window.removeEventListener('large-file-save-request', handleSaveRequest);
  }, [savePatches, tabId]);

  const discardChanges = () => {
    const resetChunk = currentChunk ? { ...currentChunk, text: currentChunk.originalText } : undefined;
    draftTextRef.current = resetChunk?.text ?? '';
    if (editorRef.current) editorRef.current.value = draftTextRef.current;
    emitState({ ...session, patches: [], chunk: resetChunk, status: 'Discarded edits.' }, false);
  };

  const modifiedLabel = modifiedAt ? new Date(modifiedAt).toLocaleString() : 'Unknown';
  const scannedPercent = fileSize > 0 ? Math.min(100, ((session.scannedBytes ?? 0) / fileSize) * 100) : 0;
  const savePercent = saveProgress?.totalBytes
    ? Math.min(100, (saveProgress.writtenBytes / saveProgress.totalBytes) * 100)
    : 0;

  return (
    <div className="large-file-panel">
      <div className="large-file-header">
        <div>
          <h2>{metadata.name}</h2>
          <p>Editable text view.</p>
        </div>
        <div className="large-file-badges" aria-label="File status">
          <span className="large-file-badge muted">{formatBytes(fileSize)}</span>
          <span className="large-file-badge success">Editable</span>
        </div>
      </div>

      <div className="large-file-toolbar">
        <button type="button" onClick={() => jumpToOffset(0)} disabled={isLoadingChunk}>Start</button>
        <button type="button" onClick={() => jumpToOffset(Math.max(0, session.currentOffset - CHUNK_BYTES))} disabled={isLoadingChunk}>Previous</button>
        <button type="button" onClick={() => jumpToOffset(currentChunk?.nextOffset ?? session.currentOffset + CHUNK_BYTES)} disabled={isLoadingChunk || currentChunk?.isEof}>Next</button>
        <button type="button" onClick={() => jumpToOffset(Math.max(0, fileSize - 1))} disabled={isLoadingChunk}>End</button>
        <input
          value={jumpValue}
          onChange={(event) => setJumpValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') jumpToPercent();
          }}
          placeholder="50% or byte offset"
        />
        <button type="button" onClick={jumpToPercent} disabled={isLoadingChunk}>Jump</button>
        <button type="button" onClick={savePatches} disabled={!hasPatches || isSaving}>Save</button>
        <button type="button" onClick={discardChanges} disabled={!hasPatches || isSaving}>Discard</button>
      </div>

      <div className="large-file-progress">
        <div style={{ width: `${progressPercent}%` }} />
      </div>
      {showDetailsPanel && (
        <div className="large-file-search-status">
          Offset {formatBytes(session.currentOffset)} / {formatBytes(fileSize)} ({progressPercent.toFixed(1)}%). {currentChunk ? `${formatBytes(currentChunk.bytesRead)} visible. ${currentChunk.newlineStyle ?? 'Unknown'} newlines.` : 'Loading text.'}
          {' '}
          Text index: {session.lineIndex?.isComplete ? 'complete' : session.lineIndex?.isIndexing ? 'building in background' : 'pending'}
          {session.lineIndex ? `, ${formatBytes(session.lineIndex.indexedBytes)} indexed, ${session.lineIndex.checkpoints.length} checkpoint(s)` : ''}.
        </div>
      )}

      <div className={`large-file-editor ${isCurrentChunkDirty ? 'dirty' : ''}`}>
        <div className="large-file-editor-meta">
          <span>{isLoadingChunk ? 'Loading...' : session.status}</span>
          <span>
            {hasPatches ? 'Unsaved changes' : 'Saved'}
            {showDetailsPanel ? ` · ${byteLength(currentText)} visible bytes` : ''}
          </span>
        </div>
        <textarea
          ref={editorRef}
          defaultValue={currentText}
          onChange={(event) => updateCurrentText(event.target.value)}
          onBlur={() => flushEditorDraft()}
          spellCheck={false}
          wrap="off"
          aria-label="Text editor"
        />
      </div>

      {isSaving && saveProgress && (
        <div className="large-file-save-progress" role="status" aria-live="polite">
          <span>{saveProgress.phase} {savePercent.toFixed(0)}%</span>
          <div className="large-file-progress">
            <div style={{ width: `${savePercent}%` }} />
          </div>
        </div>
      )}

      {showDetailsPanel && (
        <details className="large-file-details">
          <summary>Text engine details</summary>
          <div className="large-file-grid">
            <div className="large-file-field">
              <span>Size</span>
              <strong>{formatBytes(fileSize)}</strong>
            </div>
            <div className="large-file-field">
              <span>Extension</span>
              <strong>{metadata.extension || 'None'}</strong>
            </div>
            <div className="large-file-field">
              <span>Modified</span>
              <strong>{modifiedLabel}</strong>
            </div>
            <div className="large-file-field large-file-path">
              <span>Path</span>
              <strong>{metadata.path}</strong>
            </div>
          </div>

          <div className="large-file-disabled">
            <span>Full preview disabled</span>
            <span>Full outline disabled</span>
            <span>Full math rendering disabled</span>
            <span>Full syntax highlighting disabled</span>
            <span>Patch-based saves enabled</span>
          </div>
        </details>
      )}

      <div className="large-file-search">
        <div className="large-file-search-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearch();
            }}
            placeholder="Search in file"
          />
          <button type="button" onClick={runSearch} disabled={isSearching || !query.trim()}>
            Search
          </button>
          <button type="button" onClick={() => { cancelSearchRef.current = true; }} disabled={!isSearching}>
            Cancel
          </button>
        </div>
        <div className="large-file-progress">
          <div style={{ width: `${scannedPercent}%` }} />
        </div>
        <div className="large-file-search-status">
          {(session.searchResults ?? []).length} result(s). {session.scannedBytes ? `${formatBytes(session.scannedBytes)} scanned.` : ''}
        </div>
        <div className="large-file-results">
          {(session.searchResults ?? []).map((result, index) => (
            <button
              className="large-file-result"
              key={`${result.byteOffset}-${index}`}
              type="button"
              onClick={() => jumpToOffset(Math.max(0, result.byteOffset - 1024))}
            >
              <span>Line {result.line}</span>
              <code>{result.preview}</code>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
