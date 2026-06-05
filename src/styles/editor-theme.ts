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
      boxShadow: '0 0 10px var(--color-accent)',
      transition: 'all 0.1s ease',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--color-selection)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      boxShadow: 'inset 0 0 10px rgba(255,255,255,0.02)',
      borderRadius: '4px',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--color-text-muted)',
      border: 'none',
      borderRight: '1px solid var(--color-border-subtle)',
      minWidth: '48px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--color-accent)',
      fontWeight: 'bold',
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
      backgroundColor: 'rgba(124, 92, 252, 0.4)',
      outline: '1px solid rgba(124, 92, 252, 0.6)',
      borderRadius: '2px',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(124, 92, 252, 0.7)',
      outline: '1px solid var(--color-accent)',
      boxShadow: '0 0 8px rgba(124, 92, 252, 0.5)',
      borderRadius: '2px',
    },
    '.cm-panel.cm-search': {
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color: 'var(--color-text-primary)',
      padding: '8px 12px',
      borderBottom: '1px solid var(--color-border-subtle)',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--font-size-sm)',
    },
    '.cm-panel.cm-search input': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '4px 8px',
      marginRight: '8px',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--font-size-sm)',
      outline: 'none',
      transition: 'border-color 0.2s, background-color 0.2s',
    },
    '.cm-panel.cm-search input:focus': {
      borderColor: 'var(--color-accent)',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    '.cm-panel.cm-search button': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      color: 'var(--color-text-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '4px 12px',
      marginRight: '4px',
      cursor: 'pointer',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--font-size-sm)',
      transition: 'all 0.2s ease',
      textTransform: 'capitalize',
    },
    '.cm-panel.cm-search button:hover': {
      backgroundColor: 'var(--color-hover)',
      color: 'var(--color-text-primary)',
      borderColor: 'var(--color-border-hover)',
    },
    '.cm-panel.cm-search label': {
      marginLeft: '8px',
      cursor: 'pointer',
      color: 'var(--color-text-secondary)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    },
    '.cm-panel.cm-search input[type="checkbox"]': {
      accentColor: 'var(--color-accent)',
      cursor: 'pointer',
      margin: '0',
    },
    '.cm-panel.cm-search [name="close"]': {
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      backgroundColor: 'transparent',
      border: 'none',
      fontSize: '18px',
      color: 'var(--color-text-muted)',
      padding: '4px',
      cursor: 'pointer',
    },
    '.cm-panel.cm-search [name="close"]:hover': {
      color: 'var(--color-text-primary)',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 'var(--radius-sm)',
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
    { tag: t.heading1, fontSize: '1.8em', fontWeight: 'bold', color: '#fff', fontFamily: 'var(--font-display)' },
    { tag: t.heading2, fontSize: '1.5em', fontWeight: 'bold', color: '#e2e2e9', fontFamily: 'var(--font-display)' },
    { tag: t.heading3, fontSize: '1.2em', fontWeight: 'bold', color: '#c792ea', fontFamily: 'var(--font-display)' },
  ])
);
