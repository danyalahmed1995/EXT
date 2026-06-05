import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * CodeMirror 6 theme that reads CSS custom properties
 * to match the EXT Material Dark Purple theme.
 */
export const extEditorTheme: Extension = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--color-editor)',
      color: 'var(--color-text-primary)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--font-size-lg)',
      lineHeight: 'var(--line-height-relaxed)',
    },
    '.cm-content': {
      caretColor: 'var(--color-accent)',
      padding: '8px 0',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--color-accent)',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--color-selection)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--color-editor)',
      color: 'var(--color-text-muted)',
      border: 'none',
      borderRight: '1px solid var(--color-border-subtle)',
      minWidth: '48px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      color: 'var(--color-text-secondary)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 16px',
      fontSize: 'var(--font-size-sm)',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--color-surface-elevated)',
      color: 'var(--color-text-muted)',
      border: 'none',
      borderRadius: 'var(--radius-sm)',
      padding: '0 4px',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--color-surface-elevated)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-panel)',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: 'var(--color-active)',
      },
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
    },
    '.cm-matchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'rgba(124, 92, 252, 0.2)',
      outline: 'none',
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(245, 166, 35, 0.3)',
      outline: '1px solid rgba(245, 166, 35, 0.5)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(245, 166, 35, 0.5)',
    },
  },
  { dark: true }
);

/**
 * Syntax highlighting colors for the editor theme.
 */
export const extHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: '#c792ea' },
    { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#e2e2e9' },
    { tag: [t.function(t.variableName), t.labelName], color: '#82aaff' },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#f78c6c' },
    { tag: [t.definition(t.name), t.separator], color: '#e2e2e9' },
    { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#ffcb6b' },
    { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#89ddff' },
    { tag: [t.meta, t.comment], color: '#606075', fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold', color: '#f78c6c' },
    { tag: t.emphasis, fontStyle: 'italic', color: '#c3e88d' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: '#7c5cfc', textDecoration: 'underline' },
    { tag: t.heading, fontWeight: 'bold', color: '#c792ea' },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#f78c6c' },
    { tag: [t.processingInstruction, t.string, t.inserted], color: '#c3e88d' },
    { tag: t.invalid, color: '#f5546a' },
    { tag: t.heading1, fontSize: '1.4em', fontWeight: 'bold' },
    { tag: t.heading2, fontSize: '1.2em', fontWeight: 'bold' },
    { tag: t.heading3, fontSize: '1.1em', fontWeight: 'bold' },
  ])
);
