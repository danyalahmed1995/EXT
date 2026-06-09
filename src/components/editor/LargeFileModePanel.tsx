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

interface LargeFileModePanelProps {
  tabId: string;
  workspacePath?: string;
  relativePath?: string;
  metadata: LargeFileMetadata;
  state?: LargeFileSessionState;
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

const CHUNK_BYTES = 256 * 1024;
const SEARCH_CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_VISIBLE_RESULTS = 200;

function createInitialState(): LargeFileSessionState {
  return {
    currentOffset: 0,
    patches: [],
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

export const LargeFileModePanel: React.FC<LargeFileModePanelProps> = ({
  tabId,
  workspacePath,
  relativePath,
  metadata,
  state,
  onStateChange,
}) => {
  const session = state ?? createInitialState();
  const [query, setQuery] = React.useState(session.searchQuery ?? '');
  const [jumpValue, setJumpValue] = React.useState('');
  const [isLoadingChunk, setIsLoadingChunk] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const cancelSearchRef = React.useRef(false);
  const cancelIndexRef = React.useRef(false);
  const loadingRef = React.useRef(0);
  const sessionRef = React.useRef(session);

  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const currentChunk = session.chunk;
  const currentText = currentChunk?.text ?? '';
  const isCurrentChunkDirty = Boolean(
    currentChunk && currentChunk.text !== currentChunk.originalText,
  );
  const hasPatches = session.patches.length > 0 || isCurrentChunkDirty;
  const progressPercent = metadata.size > 0 ? Math.min(100, (session.currentOffset / metadata.size) * 100) : 0;

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

  const loadChunk = React.useCallback(async (offset: number, baseState = session) => {
    if (!workspacePath || !relativePath) return;

    const requestId = ++loadingRef.current;
    const safeOffset = Math.max(0, Math.min(offset, Math.max(0, metadata.size - 1)));
    const startedAt = performance.now();
    setIsLoadingChunk(true);

    try {
      const preserved = withPreservedCurrentPatch(baseState);
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
        `[LargeFile] chunk read tab=${tabId} offset=${chunk.offset} bytes=${chunk.bytesRead} elapsed_ms=${(performance.now() - startedAt).toFixed(1)}`,
      );

      emitState({
        ...preserved,
        currentOffset: chunk.offset,
        chunk: chunkState,
        status: `Loaded ${formatBytes(chunk.bytesRead)} at ${formatBytes(chunk.offset)}.`,
      }, preserved.patches.length > 0);
    } catch (err) {
      console.error('[LargeFile] chunk load failed:', err);
      emitState({ ...baseState, status: `Chunk load failed: ${err}` }, baseState.patches.length > 0);
    } finally {
      if (requestId === loadingRef.current) setIsLoadingChunk(false);
    }
  }, [emitState, metadata.size, relativePath, session, tabId, withPreservedCurrentPatch, workspacePath]);

  React.useEffect(() => {
    if (!session.chunk && !isLoadingChunk) {
      loadChunk(session.currentOffset || 0, session);
    }
  }, [isLoadingChunk, loadChunk, session]);

  React.useEffect(() => {
    return () => {
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
    };
  }, [relativePath, tabId, workspacePath]); // Keep index task alive across tab-state updates.

  const updateCurrentText = (text: string) => {
    if (!currentChunk) return;
    const nextChunk = { ...currentChunk, text };
    const nextState = withPreservedCurrentPatch({ ...session, chunk: nextChunk });
    emitState({ ...nextState, chunk: nextChunk, status: 'Chunk edit pending.' }, true);
  };

  const jumpToOffset = (offset: number) => {
    loadChunk(offset, session);
  };

  const jumpToPercent = () => {
    const trimmed = jumpValue.trim();
    if (!trimmed) return;
    if (trimmed.endsWith('%')) {
      const percent = Number(trimmed.slice(0, -1));
      if (Number.isFinite(percent)) jumpToOffset(Math.floor((Math.max(0, Math.min(100, percent)) / 100) * metadata.size));
      return;
    }
    const offset = Number(trimmed);
    if (Number.isFinite(offset)) jumpToOffset(offset);
  };

  const runSearch = React.useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !workspacePath || !relativePath) return;

    cancelSearchRef.current = false;
    setIsSearching(true);
    let offset = 0;
    let lineOffset = 0;
    let totalScanned = 0;
    let accumulatedResults: LargeFileSearchResult[] = [];
    const startedAt = performance.now();
    emitState({ ...session, searchQuery: trimmed, searchResults: [], scannedBytes: 0, status: 'Searching...' }, hasPatches);

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

        totalScanned += chunk.scannedBytes;
        offset = chunk.nextOffset;
        lineOffset += chunk.linesScanned;
        accumulatedResults = [...accumulatedResults, ...chunk.matches].slice(0, MAX_VISIBLE_RESULTS);

        emitState({
          ...session,
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
            ...session,
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
        emitState({ ...session, status: 'Search cancelled.' }, hasPatches);
      }
    } catch (err) {
      console.error('[LargeFile] search failed:', err);
      emitState({ ...session, status: `Search failed: ${err}` }, hasPatches);
    } finally {
      setIsSearching(false);
    }
  }, [emitState, hasPatches, query, relativePath, session, tabId, workspacePath]);

  const savePatches = React.useCallback(async () => {
    if (!workspacePath || !relativePath) return;
    const stateToSave = withPreservedCurrentPatch(session);
    if (stateToSave.patches.length === 0) return;

    const startedAt = performance.now();
    setIsSaving(true);
    emitState({ ...stateToSave, status: `Saving ${stateToSave.patches.length} patch(es)...` }, true);

    try {
      const result = await invoke<SaveResult>('save_large_file_patches', {
        workspacePath,
        relativePath,
        patches: stateToSave.patches.map(({ start, end, text }) => ({ start, end, text })),
      });

      console.log(
        `[LargeFile] save complete tab=${tabId} patches=${result.patchCount} size=${result.size} elapsed_ms=${(performance.now() - startedAt).toFixed(1)}`,
      );
      emitState({
        ...stateToSave,
        patches: [],
        chunk: stateToSave.chunk ? { ...stateToSave.chunk, originalText: stateToSave.chunk.text } : undefined,
        status: `Saved ${result.patchCount} patch(es). Backup: ${result.backupPath ?? 'none'}`,
      }, false);
    } catch (err) {
      console.error('[LargeFile] save failed:', err);
      emitState({ ...stateToSave, status: `Save failed: ${err}` }, true);
    } finally {
      setIsSaving(false);
    }
  }, [emitState, relativePath, session, tabId, withPreservedCurrentPatch, workspacePath]);

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
    emitState({ ...session, patches: [], chunk: resetChunk, status: 'Discarded large-file edits.' }, false);
  };

  const modifiedLabel = metadata.modifiedAt ? new Date(metadata.modifiedAt).toLocaleString() : 'Unknown';
  const scannedPercent = metadata.size > 0 ? Math.min(100, ((session.scannedBytes ?? 0) / metadata.size) * 100) : 0;

  return (
    <div className="large-file-panel">
      <div className="large-file-header">
        <div>
          <h2>This file is very large and has been opened in Large File Mode.</h2>
          <p>The visible content is loaded in chunks. Edits are tracked as patch ranges and saved by streaming the file safely.</p>
        </div>
        <span className="large-file-badge">Large File Mode</span>
      </div>

      <div className="large-file-grid">
        <div className="large-file-field">
          <span>Name</span>
          <strong>{metadata.name}</strong>
        </div>
        <div className="large-file-field">
          <span>Size</span>
          <strong>{formatBytes(metadata.size)}</strong>
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
        <span>Chunked editing enabled</span>
      </div>

      <div className="large-file-toolbar">
        <button type="button" onClick={() => jumpToOffset(0)} disabled={isLoadingChunk}>Start</button>
        <button type="button" onClick={() => jumpToOffset(Math.max(0, session.currentOffset - CHUNK_BYTES))} disabled={isLoadingChunk}>Previous</button>
        <button type="button" onClick={() => jumpToOffset(currentChunk?.nextOffset ?? session.currentOffset + CHUNK_BYTES)} disabled={isLoadingChunk || currentChunk?.isEof}>Next</button>
        <button type="button" onClick={() => jumpToOffset(Math.max(0, metadata.size - CHUNK_BYTES))} disabled={isLoadingChunk}>End</button>
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
      <div className="large-file-search-status">
        Offset {formatBytes(session.currentOffset)} / {formatBytes(metadata.size)} ({progressPercent.toFixed(1)}%). {currentChunk ? `${formatBytes(currentChunk.bytesRead)} loaded. ${currentChunk.newlineStyle ?? 'Unknown'} newlines.` : 'No chunk loaded.'}
      </div>
      <div className="large-file-search-status">
        Sparse line index: {session.lineIndex?.isComplete ? 'complete' : session.lineIndex?.isIndexing ? 'building in background' : 'pending'}
        {session.lineIndex ? `, ${formatBytes(session.lineIndex.indexedBytes)} indexed, ${session.lineIndex.checkpoints.length} checkpoint(s)` : ''}.
      </div>

      <div className={`large-file-editor ${isCurrentChunkDirty ? 'dirty' : ''}`}>
        <div className="large-file-editor-meta">
          <span>{isLoadingChunk ? 'Loading chunk...' : session.status}</span>
          <span>{session.patches.length} saved patch range(s), {byteLength(currentText)} visible bytes</span>
        </div>
        <textarea
          value={currentText}
          onChange={(event) => updateCurrentText(event.target.value)}
          spellCheck={false}
          wrap="off"
          aria-label="Large file chunk editor"
        />
      </div>

      <div className="large-file-search">
        <div className="large-file-search-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearch();
            }}
            placeholder="Streaming search in this large file"
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
