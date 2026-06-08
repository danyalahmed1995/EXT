import React, { useCallback, useEffect, useRef } from 'react';
import { EditorView, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { autocompletion } from '@codemirror/autocomplete';
import { extEditorTheme, extHighlightStyle } from '../../styles/editor-theme';
import { getPerfTier } from '../../utils/performanceMode';
import { markdownCompletionSource } from './markdownAutocomplete';
import { createViewportSmartEditingPlugin } from './viewportSmartEditing';
import { hugeMarkdownSyntaxPlugin } from './hugeMarkdownSyntax';

interface CodeMirrorEditorProps {
  activeTabId: string;
  content: string;
  onChange?: (tabId: string, content: string) => void;
  onSave?: (tabId: string) => void;
  isActive?: boolean;
}

interface CachedState {
  state: EditorState;
  scrollTop: number;
  scrollLeft: number;
  contentLength: number;
}

const MAX_CACHED_STATES = 6;

function recordNavTiming(key: string, elapsed: number): void {
  const navPerf = (window as any).__NAV_PERF;
  if (navPerf) {
    navPerf[key] = Math.max(navPerf[key] || 0, elapsed);
  }
}

// applyChangesToString removed in favor of native doc.toString()

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  activeTabId,
  content,
  onChange,
  onSave,
  isActive,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const stateCache = useRef<Map<string, CachedState>>(new Map());
  const contentCache = useRef<Map<string, string>>(new Map());
  const pendingChangeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevTabId = useRef<string | null>(null);
  const activeTabIdRef = useRef(activeTabId);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [activeTabId, onChange, onSave]);

  const clearPendingChange = useCallback((tabId: string) => {
    const timer = pendingChangeTimers.current.get(tabId);
    if (timer) {
      clearTimeout(timer);
      pendingChangeTimers.current.delete(tabId);
    }
  }, []);

  const scheduleChange = useCallback((tabId: string, nextContent: string) => {
    clearPendingChange(tabId);
    const timer = setTimeout(() => {
      pendingChangeTimers.current.delete(tabId);
      onChangeRef.current?.(tabId, nextContent);
    }, 300);
    pendingChangeTimers.current.set(tabId, timer);
  }, [clearPendingChange]);

  const createExtensions = useCallback((tabId: string, contentLength: number): Extension[] => {
    const t0 = performance.now();
    const tier = getPerfTier(contentLength);
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightSpecialChars(),
      drawSelection(),
      search({ top: true }),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            clearPendingChange(tabId);
            const latestContent = contentCache.current.get(tabId);
            if (latestContent != null) {
              onChangeRef.current?.(tabId, latestContent);
            }
            onSaveRef.current?.(tabId);
            return true;
          },
        },
      ]),
      extEditorTheme,
      extHighlightStyle,
      EditorView.contentAttributes.of({ spellcheck: tier === 'huge' ? 'false' : 'true' }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;

        const tChangeStart = performance.now();
        const nextContent = update.state.doc.toString();
        const elapsed = performance.now() - tChangeStart;
        contentCache.current.set(tabId, nextContent);
        scheduleChange(tabId, nextContent);

        recordNavTiming('cmChangeApply', elapsed);
        if (elapsed > 16) {
          console.warn(`[NavigationPerf] CodeMirror change apply: ${elapsed.toFixed(1)}ms (${(nextContent.length / 1024).toFixed(0)}KB)`);
        }
      }),
    ];

    if (tier === 'normal') {
      const tLang = performance.now();
      const mdExt = markdown({ codeLanguages: languages });
      const mdElapsed = performance.now() - tLang;
      if (mdElapsed > 10) console.warn(`[NavigationPerf] Markdown lang activation: ${mdElapsed.toFixed(1)}ms`);

      extensions.splice(
        8,
        0,
        indentOnInput(),
        bracketMatching(),
        foldGutter(),
        highlightSelectionMatches(),
        mdExt,
        EditorView.lineWrapping,
        autocompletion({ override: [markdownCompletionSource] }),
      );
    } else if (tier === 'large') {
      extensions.splice(
        8,
        0,
        bracketMatching(),
        highlightSelectionMatches(),
        markdown({ codeLanguages: languages }),
        createViewportSmartEditingPlugin(tabId, { debounceMs: 500, bufferSize: 1000 }),
        autocompletion({ override: [markdownCompletionSource] }),
      );
    } else { // huge
      extensions.splice(
        8, 
        0, 
        bracketMatching(), 
        highlightSelectionMatches(),
        hugeMarkdownSyntaxPlugin,
        createViewportSmartEditingPlugin(tabId, { debounceMs: 1000, bufferSize: 400 }),
        autocompletion({ override: [markdownCompletionSource] }),
      );
    }

    const tTotal = performance.now() - t0;
    if (tTotal > 16) console.warn(`[NavigationPerf] Extension array construction: ${tTotal.toFixed(1)}ms`);

    return extensions;
  }, [clearPendingChange, scheduleChange]);

  const createEditorState = useCallback((tabId: string, doc: string) => {
    const tier = getPerfTier(doc.length);
    const t0 = performance.now();
    const state = EditorState.create({
      doc,
      extensions: createExtensions(tabId, doc.length),
    });
    const elapsed = performance.now() - t0;

    recordNavTiming('cmStateCreate', elapsed);
    if (elapsed > 16) {
      console.warn(
        `[NavigationPerf] CodeMirror state create: ${elapsed.toFixed(1)}ms mode=${tier} size=${(doc.length / 1024).toFixed(0)}KB`,
      );
    }

    contentCache.current.set(tabId, doc);
    return state;
  }, [createExtensions]);

  const enforceCacheLimit = useCallback((protectedTabId: string) => {
    while (stateCache.current.size > MAX_CACHED_STATES) {
      const firstKey = stateCache.current.keys().next().value as string | undefined;
      if (!firstKey) return;
      if (firstKey === protectedTabId) {
        const protectedEntry = stateCache.current.get(firstKey);
        stateCache.current.delete(firstKey);
        if (protectedEntry) stateCache.current.set(firstKey, protectedEntry);
        continue;
      }
      stateCache.current.delete(firstKey);
      contentCache.current.delete(firstKey);
      clearPendingChange(firstKey);
    }
  }, [clearPendingChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const initialState = createEditorState(activeTabId, content);
    const t0 = performance.now();
    const view = new EditorView({
      state: initialState,
      parent: containerRef.current,
    });
    const mountElapsed = performance.now() - t0;
    recordNavTiming('cmViewMount', mountElapsed);
    if (mountElapsed > 16) {
      console.warn(`[NavigationPerf] CodeMirror view mount: ${mountElapsed.toFixed(1)}ms`);
    }

    viewRef.current = view;
    prevTabId.current = activeTabId;
    stateCache.current.set(activeTabId, {
      state: initialState,
      scrollTop: 0,
      scrollLeft: 0,
      contentLength: content.length,
    });

    requestAnimationFrame(() => {
      if (activeTabIdRef.current === activeTabId) {
        console.log('[NavigationPerf] editor usable: initial paint');
      }
    });

    return () => {
      for (const timer of pendingChangeTimers.current.values()) clearTimeout(timer);
      pendingChangeTimers.current.clear();
      view.destroy();
      viewRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const previousTabId = prevTabId.current;
    if (previousTabId && previousTabId !== activeTabId) {
      stateCache.current.set(previousTabId, {
        state: view.state,
        scrollTop: view.scrollDOM.scrollTop,
        scrollLeft: view.scrollDOM.scrollLeft,
        contentLength: contentCache.current.get(previousTabId)?.length ?? view.state.doc.length,
      });
      enforceCacheLimit(activeTabId);
    }

    if (previousTabId !== activeTabId) {
      const cached = stateCache.current.get(activeTabId);
      const cachedContent = contentCache.current.get(activeTabId);
      const hasPendingLocalChange = pendingChangeTimers.current.has(activeTabId);
      let nextState = cached?.state;
      let scrollTop = cached?.scrollTop ?? 0;
      let scrollLeft = cached?.scrollLeft ?? 0;

      if (!nextState || (!hasPendingLocalChange && cachedContent !== undefined && cachedContent !== content)) {
        nextState = createEditorState(activeTabId, content);
        scrollTop = 0;
        scrollLeft = 0;
      } else if (!nextState) {
        nextState = createEditorState(activeTabId, cachedContent ?? content);
      }

      const setStateStart = performance.now();
      view.setState(nextState);
      const setStateElapsed = performance.now() - setStateStart;
      recordNavTiming('cmSetState', setStateElapsed);
      if (setStateElapsed > 16) {
        console.warn(`[NavigationPerf] CodeMirror setState: ${setStateElapsed.toFixed(1)}ms cached=${Boolean(cached)}`);
      }

      stateCache.current.delete(activeTabId);
      stateCache.current.set(activeTabId, {
        state: nextState,
        scrollTop,
        scrollLeft,
        contentLength: contentCache.current.get(activeTabId)?.length ?? content.length,
      });
      enforceCacheLimit(activeTabId);

      requestAnimationFrame(() => {
        if (activeTabIdRef.current !== activeTabId) return;
        view.scrollDOM.scrollTop = scrollTop;
        view.scrollDOM.scrollLeft = scrollLeft;
        console.log(`[NavigationPerf] editor usable: ${activeTabId.slice(0, 16)}`);
      });

      prevTabId.current = activeTabId;
      return;
    }

    const cachedContent = contentCache.current.get(activeTabId);
    const hasPendingLocalChange = pendingChangeTimers.current.has(activeTabId);
    if (!hasPendingLocalChange && cachedContent !== content) {
      const nextState = createEditorState(activeTabId, content);
      const setStateStart = performance.now();
      view.setState(nextState);
      const setStateElapsed = performance.now() - setStateStart;
      recordNavTiming('cmSetState', setStateElapsed);
      if (setStateElapsed > 16) {
        console.warn(`[NavigationPerf] CodeMirror external content setState: ${setStateElapsed.toFixed(1)}ms`);
      }
      stateCache.current.set(activeTabId, {
        state: nextState,
        scrollTop: view.scrollDOM.scrollTop,
        scrollLeft: view.scrollDOM.scrollLeft,
        contentLength: content.length,
      });
    }
  }, [activeTabId, content, createEditorState, enforceCacheLimit]);

  useEffect(() => {
    const handleCopy = () => {
      if (viewRef.current && isActive) {
        const selection = viewRef.current.state.sliceDoc(
          viewRef.current.state.selection.main.from,
          viewRef.current.state.selection.main.to,
        );
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
      }
    };
    const handleDelete = () => {
      if (viewRef.current && isActive) {
        viewRef.current.dispatch({
          changes: {
            from: viewRef.current.state.selection.main.from,
            to: viewRef.current.state.selection.main.to,
            insert: '',
          },
        });
      }
    };
    window.addEventListener('editor-copy', handleCopy);
    window.addEventListener('editor-delete', handleDelete);
    return () => {
      window.removeEventListener('editor-copy', handleCopy);
      window.removeEventListener('editor-delete', handleDelete);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const rafId = requestAnimationFrame(() => {
      viewRef.current?.requestMeasure();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isActive]);

  useEffect(() => {
    const handleFocusActiveEditor = () => {
      if (isActive) viewRef.current?.focus();
    };

    window.addEventListener('editor-focus-active', handleFocusActiveEditor);
    return () => window.removeEventListener('editor-focus-active', handleFocusActiveEditor);
  }, [isActive]);

  useEffect(() => {
    const handleReadActiveContent = (event: Event) => {
      if (!isActive || !viewRef.current) return;
      const customEvent = event as CustomEvent<{ content?: string }>;
      customEvent.detail.content = viewRef.current.state.doc.toString();
    };

    window.addEventListener('editor-read-active-content', handleReadActiveContent);
    return () => window.removeEventListener('editor-read-active-content', handleReadActiveContent);
  }, [isActive]);

  useEffect(() => {
    const handleScrollToLine = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { lineIndex } = customEvent.detail;
      if (viewRef.current && typeof lineIndex === 'number' && isActive) {
        const view = viewRef.current;
        const targetLine = Math.min(Math.max(1, lineIndex + 1), view.state.doc.lines);
        const lineInfo = view.state.doc.line(targetLine);

        view.dispatch({
          selection: { anchor: lineInfo.from, head: lineInfo.from },
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
        });
        view.focus();
      }
    };

    window.addEventListener('editor-scroll-to-line', handleScrollToLine);
    return () => window.removeEventListener('editor-scroll-to-line', handleScrollToLine);
  }, [isActive]);

  return <div className="codemirror-wrapper" ref={containerRef} />;
};
