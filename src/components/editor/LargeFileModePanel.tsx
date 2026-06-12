import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  LargeFileMetadata,
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
  showDetailsPanel?: boolean;
  onStateChange?: (state: LargeFileSessionState, isDirty: boolean) => void;
}

interface SearchChunkResult {
  matches: LargeFileSearchResult[];
  scannedBytes: number;
  linesScanned: number;
  nextOffset: number;
  isEof: boolean;
}

const SEARCH_CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_VISIBLE_RESULTS = 200;

function createInitialState(): LargeFileSessionState {
  return {
    currentOffset: 0,
    patches: [],
    searchResults: [],
    scannedBytes: 0,
    status: 'Large File Mode',
  };
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
  const [isSearching, setIsSearching] = React.useState(false);
  const cancelSearchRef = React.useRef(false);
  const searchRef = React.useRef(0);

  const emitState = React.useCallback((next: LargeFileSessionState) => {
    onStateChange?.(next, false);
  }, [onStateChange]);

  const runSearch = React.useCallback(async () => {
    const trimmed = query.trim();
    if (!workspacePath || !relativePath || !trimmed || isSearching) return;

    const searchId = ++searchRef.current;
    cancelSearchRef.current = false;
    setIsSearching(true);
    emitState({
      ...session,
      searchQuery: trimmed,
      searchResults: [],
      scannedBytes: 0,
      status: 'Searching...',
    });

    let offset = 0;
    let lineOffset = 0;
    let accumulatedResults: LargeFileSearchResult[] = [];

    try {
      while (!cancelSearchRef.current) {
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

        accumulatedResults = [...accumulatedResults, ...chunk.matches].slice(0, MAX_VISIBLE_RESULTS);
        offset = chunk.nextOffset;
        lineOffset += chunk.linesScanned;
        const scannedBytes = offset;

        emitState({
          ...session,
          searchQuery: trimmed,
          searchResults: accumulatedResults,
          scannedBytes,
          status: chunk.isEof ? 'Search complete.' : 'Searching...',
        });

        if (chunk.isEof || accumulatedResults.length >= MAX_VISIBLE_RESULTS) break;
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      if (cancelSearchRef.current && searchId === searchRef.current) {
        emitState({
          ...session,
          searchQuery: trimmed,
          searchResults: accumulatedResults,
          scannedBytes: offset,
          status: 'Search cancelled.',
        });
      }
    } catch (err) {
      emitState({
        ...session,
        searchQuery: trimmed,
        searchResults: accumulatedResults,
        scannedBytes: offset,
        status: `Search failed: ${err}`,
      });
    } finally {
      if (searchId === searchRef.current) setIsSearching(false);
    }
  }, [emitState, isSearching, query, relativePath, session, workspacePath]);

  const modifiedLabel = metadata.modifiedAt ? new Date(metadata.modifiedAt).toLocaleString() : 'Unknown';
  const scannedPercent = metadata.size > 0
    ? Math.min(100, ((session.scannedBytes ?? 0) / metadata.size) * 100)
    : 0;

  return (
    <div className="large-file-panel">
      <div className="large-file-header">
        <div>
          <h2>This file is very large and has been opened in Large File Mode.</h2>
          <p>EXT is showing metadata and safe tools without loading the full file into the normal editor.</p>
        </div>
        <div className="large-file-badges" aria-label="File status">
          <span className="large-file-badge">Large File Mode</span>
          <span className="large-file-badge muted">{formatBytes(metadata.size)}</span>
          <span className="large-file-badge muted">Read-only / limited</span>
        </div>
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
        <span>Preview disabled</span>
        <span>Full outline disabled</span>
        <span>Full math rendering disabled</span>
        <span>Full syntax highlighting disabled</span>
        <span>Undo stack disabled</span>
      </div>

      {showDetailsPanel && (
        <p className="large-file-search-status">
          Use Open With from the file or tab context menu for full editing in an external editor.
        </p>
      )}

      <div className="large-file-search">
        <div className="large-file-search-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearch();
            }}
            placeholder="Streaming search in this file"
          />
          <button type="button" onClick={runSearch} disabled={isSearching || !query.trim()}>
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              cancelSearchRef.current = true;
              searchRef.current += 1;
              setIsSearching(false);
              emitState({ ...session, status: 'Search cancelled.' });
            }}
            disabled={!isSearching}
          >
            Cancel
          </button>
        </div>
        <div className="large-file-progress">
          <div style={{ width: `${scannedPercent}%` }} />
        </div>
        <div className="large-file-search-status">
          {session.status ?? 'Large File Mode'} · {(session.searchResults ?? []).length} result(s)
          {session.scannedBytes ? ` · ${formatBytes(session.scannedBytes)} scanned` : ''}
        </div>
        <div className="large-file-results">
          {(session.searchResults ?? []).map((result, index) => (
            <div
              className="large-file-result"
              key={`${tabId}-${result.byteOffset}-${index}`}
            >
              <span>Line {result.line}</span>
              <code>{result.preview}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
