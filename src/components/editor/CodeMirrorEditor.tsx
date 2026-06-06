import React, { useEffect, useRef } from 'react';
import { EditorView, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { extEditorTheme, extHighlightStyle } from '../../styles/editor-theme';

interface CodeMirrorEditorProps {
  content: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  content,
  onChange,
  onSave,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  
  // Use refs for callbacks to avoid stale closures inside CodeMirror setup
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
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
              // Force immediate sync before saving
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
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChangeRef.current) {
            const newContent = update.state.doc.toString();
            
            // Debounce to prevent React re-renders from lagging the editor
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
              if (onChangeRef.current) onChangeRef.current(newContent);
            }, 300);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      view.destroy();
    };
    // Only re-create on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The CodeMirrorEditor is completely unmounted/remounted when switching tabs
  // due to the `key={activeTab.id}` prop in EditorPanel.tsx.
  // We do not need to sync `content` back into the view on every change,
  // which causes cursor jumping and lag during fast typing.

  useEffect(() => {
    const handleScrollToLine = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { lineIndex } = customEvent.detail;
      if (viewRef.current && typeof lineIndex === 'number') {
        const view = viewRef.current;
        // Make sure line is within bounds (1-indexed for CM)
        const targetLine = Math.min(Math.max(1, lineIndex + 1), view.state.doc.lines);
        const lineInfo = view.state.doc.line(targetLine);
        
        view.dispatch({
          selection: { anchor: lineInfo.from, head: lineInfo.from },
          effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' })
        });
        
        // Optional: refocus the editor
        view.focus();
      }
    };

    window.addEventListener('editor-scroll-to-line', handleScrollToLine);
    return () => window.removeEventListener('editor-scroll-to-line', handleScrollToLine);
  }, []);

  return (
    <div className="codemirror-wrapper" ref={containerRef} />
  );
};
