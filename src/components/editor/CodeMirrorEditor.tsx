import React, { useEffect, useRef, useMemo } from 'react';
import { EditorView, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { extEditorTheme, extHighlightStyle } from '../../styles/editor-theme';

interface CodeMirrorEditorProps {
  activeTabId: string;
  content: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  isActive?: boolean;
}

interface CachedState {
  state: EditorState;
  scrollTop: number;
  scrollLeft: number;
}

const MAX_CACHED_STATES = 15;

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
  const prevTabId = useRef<string | null>(null);
  
  // Use refs for callbacks to avoid stale closures inside CodeMirror setup
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  const extensions = useMemo(() => [
    lineNumbers(),
    highlightActiveLine(),
    highlightSpecialChars(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    foldGutter(),
    highlightSelectionMatches(),
    search({ top: true }),
    history(),
    keymap.of([
      ...defaultKeymap, 
      ...historyKeymap, 
      ...searchKeymap,
      {
        key: 'Mod-s',
        preventDefault: true,
        run: (view) => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (onChangeRef.current) onChangeRef.current(view.state.doc.toString());
          if (onSaveRef.current) onSaveRef.current();
          return true;
        }
      }
    ]),
    markdown({ codeLanguages: languages }),
    extEditorTheme,
    extHighlightStyle,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ spellcheck: "true" }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && onChangeRef.current) {
        const newContent = update.state.doc.toString();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (onChangeRef.current) onChangeRef.current(newContent);
        }, 300);
      }
    }),
  ], []);

  // Initialize EditorView exactly once
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      view.destroy();
    };
  }, []);

  // Handle Tab Switching and Content Updates
  useEffect(() => {
    if (!viewRef.current) return;
    const view = viewRef.current;

    if (prevTabId.current && prevTabId.current !== activeTabId) {
      const prevId = prevTabId.current;
      stateCache.current.set(prevId, {
        state: view.state,
        scrollTop: view.scrollDOM.scrollTop,
        scrollLeft: view.scrollDOM.scrollLeft
      });
    }

    // 2. Handle active tab
    if (prevTabId.current !== activeTabId) {
      let cached = stateCache.current.get(activeTabId);
      if (cached) {
        // LRU bump
        stateCache.current.delete(activeTabId);
        stateCache.current.set(activeTabId, cached);
        
        view.setState(cached.state);
        
        // Restore scroll after paint
        requestAnimationFrame(() => {
          view.scrollDOM.scrollTop = cached.scrollTop;
          view.scrollDOM.scrollLeft = cached.scrollLeft;
        });
      } else {
        // Cold mount
        const newState = EditorState.create({
          doc: content,
          extensions
        });
        view.setState(newState);
        stateCache.current.set(activeTabId, { state: newState, scrollTop: 0, scrollLeft: 0 });
        
        if (stateCache.current.size > MAX_CACHED_STATES) {
          const firstKey = stateCache.current.keys().next().value;
          if (firstKey !== undefined) {
            stateCache.current.delete(firstKey);
          }
        }
      }
      prevTabId.current = activeTabId;
    } else {
      // Same tab, handle external content changes (e.g., file reload)
      if (view.state.doc.toString() !== content) {
        const newState = EditorState.create({
          doc: content,
          extensions
        });
        view.setState(newState);
      }
    }
  }, [activeTabId, content, extensions]);

  // Handle external commands
  useEffect(() => {
    const handleCopy = () => {
      if (viewRef.current && isActive) {
        const selection = viewRef.current.state.sliceDoc(
          viewRef.current.state.selection.main.from,
          viewRef.current.state.selection.main.to
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
            insert: ''
          }
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
    const handleScrollToLine = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { lineIndex } = customEvent.detail;
      if (viewRef.current && typeof lineIndex === 'number' && isActive) {
        const view = viewRef.current;
        const targetLine = Math.min(Math.max(1, lineIndex + 1), view.state.doc.lines);
        const lineInfo = view.state.doc.line(targetLine);
        
        view.dispatch({
          selection: { anchor: lineInfo.from, head: lineInfo.from },
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' })
        });
        view.focus();
      }
    };

    window.addEventListener('editor-scroll-to-line', handleScrollToLine);
    return () => window.removeEventListener('editor-scroll-to-line', handleScrollToLine);
  }, [isActive]);

  return <div className="codemirror-wrapper" ref={containerRef} />;
};
