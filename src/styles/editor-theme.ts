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
      textRendering: 'optimizeLegibility',
      fontVariantLigatures: 'contextual',
    },
    '.cm-line': {
      textShadow: '0 0 1px rgba(255, 255, 255, 0.05)',
    },
    '@keyframes cm-smooth-blink': {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0 },
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--color-accent)',
      borderLeftWidth: '2px',
      boxShadow: '0 0 10px var(--color-accent)',
      transition: 'left 0.08s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--color-selection)',
      transition: 'background-color 0.15s ease',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--color-hover)',
      boxShadow: 'inset 0 0 10px rgba(255,255,255,0.02)',
      borderRadius: '4px',
      transition: 'background-color 0.3s ease-out, box-shadow 0.3s ease-out',
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
      transition: 'color 0.2s ease',
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
    // Huge Markdown fallback styles
    '.cm-huge-header': {
      color: 'var(--color-syntax-keyword)',
      fontWeight: 'bold',
      fontFamily: 'var(--font-display)',
    },
    '.cm-huge-list': {
      color: 'var(--color-syntax-name)',
    },
    '.cm-huge-code': {
      color: 'var(--color-syntax-string)',
      backgroundColor: 'rgba(0,0,0,0.15)',
      borderRadius: '3px',
      padding: '0 3px',
    },
    '.cm-huge-strong': {
      color: 'var(--color-syntax-constant)',
      fontWeight: 'bold',
    },
    '.cm-huge-em': {
      color: 'var(--color-syntax-string)',
      fontStyle: 'italic',
    },
    '.cm-huge-link': {
      color: 'var(--color-accent)',
      textDecoration: 'underline',
    },
    // Viewport-bounded JSON/YAML fallback styles for large structured files.
    '.cm-large-json-key, .cm-large-yaml-key, .cm-large-yaml-top-key': {
      color: 'var(--color-syntax-name)',
      fontWeight: 600,
    },
    '.cm-large-yaml-top-key': {
      color: 'var(--color-syntax-keyword)',
    },
    '.cm-large-json-string, .cm-large-yaml-string': {
      color: 'var(--color-syntax-string)',
    },
    '.cm-large-json-number, .cm-large-yaml-number': {
      color: 'var(--color-syntax-type)',
    },
    '.cm-large-json-atom, .cm-large-yaml-atom': {
      color: 'var(--color-syntax-constant)',
    },
    '.cm-large-json-punctuation, .cm-large-yaml-punctuation': {
      color: 'var(--color-syntax-operator)',
    },
    '.cm-large-yaml-anchor': {
      color: 'var(--color-syntax-function)',
    },
    '.cm-large-yaml-document, .cm-large-yaml-list': {
      color: 'var(--color-syntax-operator)',
      fontWeight: 600,
    },
    '.cm-large-yaml-comment': {
      color: 'var(--color-syntax-comment)',
      fontStyle: 'italic',
    },
  },
  { dark: true }
);

/**
 * Syntax highlighting colors for the editor theme.
 */
export const extHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: 'var(--color-syntax-keyword)' },
    { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: 'var(--color-syntax-name)' },
    { tag: [t.function(t.variableName), t.labelName], color: 'var(--color-syntax-function)' },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: 'var(--color-syntax-constant)' },
    { tag: [t.definition(t.name), t.definition(t.propertyName)], color: 'var(--color-syntax-name)', fontWeight: 600 },
    { tag: t.separator, color: 'var(--color-syntax-operator)' },
    { tag: [t.lineComment], color: 'var(--color-syntax-comment)', fontStyle: 'italic' },
    { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: 'var(--color-syntax-type)' },
    { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: 'var(--color-syntax-operator)' },
    { tag: [t.meta, t.comment], color: 'var(--color-syntax-comment)', fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold', color: 'var(--color-syntax-constant)' },
    { tag: t.emphasis, fontStyle: 'italic', color: 'var(--color-syntax-string)' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: 'var(--color-accent)', textDecoration: 'underline' },
    { tag: t.heading, fontWeight: 'bold', color: 'var(--color-syntax-keyword)' },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: 'var(--color-syntax-constant)' },
    { tag: [t.processingInstruction, t.string, t.inserted], color: 'var(--color-syntax-string)' },
    { tag: t.invalid, color: 'var(--color-syntax-invalid)' },
    { tag: t.heading1, fontSize: '1.8em', fontWeight: 'bold', color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' },
    { tag: t.heading2, fontSize: '1.5em', fontWeight: 'bold', color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' },
    { tag: t.heading3, fontSize: '1.2em', fontWeight: 'bold', color: 'var(--color-syntax-keyword)', fontFamily: 'var(--font-display)' },
  ])
);
