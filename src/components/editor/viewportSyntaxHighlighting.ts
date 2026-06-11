import { RangeSetBuilder } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { EditorLanguage } from '../../utils/fileTypes';

const MAX_HIGHLIGHT_CHARS_PER_RANGE = 60_000;

const jsonKeyDeco = Decoration.mark({ class: 'cm-large-json-key' });
const jsonStringDeco = Decoration.mark({ class: 'cm-large-json-string' });
const jsonNumberDeco = Decoration.mark({ class: 'cm-large-json-number' });
const jsonAtomDeco = Decoration.mark({ class: 'cm-large-json-atom' });
const jsonPunctuationDeco = Decoration.mark({ class: 'cm-large-json-punctuation' });

const yamlTopKeyDeco = Decoration.mark({ class: 'cm-large-yaml-top-key' });
const yamlKeyDeco = Decoration.mark({ class: 'cm-large-yaml-key' });
const yamlStringDeco = Decoration.mark({ class: 'cm-large-yaml-string' });
const yamlNumberDeco = Decoration.mark({ class: 'cm-large-yaml-number' });
const yamlAtomDeco = Decoration.mark({ class: 'cm-large-yaml-atom' });
const yamlCommentDeco = Decoration.mark({ class: 'cm-large-yaml-comment' });
const yamlPunctuationDeco = Decoration.mark({ class: 'cm-large-yaml-punctuation' });
const yamlAnchorDeco = Decoration.mark({ class: 'cm-large-yaml-anchor' });
const yamlDocumentDeco = Decoration.mark({ class: 'cm-large-yaml-document' });
const yamlListDeco = Decoration.mark({ class: 'cm-large-yaml-list' });

const jsonTokenPattern = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)|([{}\[\]:,])/g;
const yamlScalarPattern = /("(?:\\.|[^"\\])*"|'[^'\n]*')|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b|\b~\b)|([&*][A-Za-z0-9_.-]+)|([{}\[\],])|(:)/gi;
const yamlKeyPattern = /(^|[{\[,]\s*)(["'][^"'\n]+["']|[^#\n:{}[\],'"-][^#\n:{}[\],]*?)(?=\s*:)/g;

interface PendingDecoration {
  from: number;
  to: number;
  decoration: Decoration;
}

function decorationForJson(match: RegExpExecArray): Decoration | null {
  if (match[1]) return jsonKeyDeco;
  if (match[2]) return jsonStringDeco;
  if (match[3]) return jsonNumberDeco;
  if (match[4]) return jsonAtomDeco;
  if (match[5]) return jsonPunctuationDeco;
  return null;
}

function decorationForYaml(match: RegExpExecArray): Decoration | null {
  if (match[1]) return yamlStringDeco;
  if (match[2]) return yamlNumberDeco;
  if (match[3]) return yamlAtomDeco;
  if (match[4]) return yamlAnchorDeco;
  if (match[5] || match[6]) return yamlPunctuationDeco;
  return null;
}

function findCommentStart(line: string): number {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quote) {
      if (char === quote && (quote === "'" || line[index - 1] !== '\\')) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '#') return index;
  }
  return -1;
}

function addYamlScalars(decorations: PendingDecoration[], from: number, text: string): void {
  yamlScalarPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = yamlScalarPattern.exec(text)) !== null) {
    const decoration = decorationForYaml(match);
    if (!decoration) continue;
    const start = from + match.index;
    const end = start + match[0].length;
    if (end > start) decorations.push({ from: start, to: end, decoration });
  }
}

function addYamlKeys(decorations: PendingDecoration[], from: number, text: string, keyDecoration: Decoration): void {
  yamlKeyPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = yamlKeyPattern.exec(text)) !== null) {
    const key = match[2];
    const keyStart = from + match.index + match[1].length;
    const keyEnd = keyStart + key.length;
    if (keyEnd > keyStart) decorations.push({ from: keyStart, to: keyEnd, decoration: keyDecoration });
  }
}

function addYamlLineDecorations(decorations: PendingDecoration[], lineStart: number, line: string): void {
  const commentStart = findCommentStart(line);
  const codeEnd = commentStart >= 0 ? commentStart : line.length;
  const code = line.slice(0, codeEnd);
  const trimmed = code.trim();

  if (!trimmed) {
    if (commentStart >= 0) {
      decorations.push({ from: lineStart + commentStart, to: lineStart + line.length, decoration: yamlCommentDeco });
    }
    return;
  }

  const indentLength = code.match(/^\s*/)?.[0].length ?? 0;
  const contentStart = lineStart + indentLength;
  const content = code.slice(indentLength);

  if (/^(---|\.\.\.)\s*$/.test(content)) {
    decorations.push({ from: contentStart, to: contentStart + content.trimEnd().length, decoration: yamlDocumentDeco });
    return;
  }

  const listMatch = content.match(/^-\s+/);
  const keyContent = listMatch ? content.slice(listMatch[0].length) : content;
  const keyOffset = contentStart + (listMatch?.[0].length ?? 0);
  if (listMatch) {
    decorations.push({ from: contentStart, to: contentStart + 1, decoration: yamlListDeco });
  }

  addYamlKeys(decorations, keyOffset, keyContent, indentLength === 0 ? yamlTopKeyDeco : yamlKeyDeco);
  addYamlScalars(decorations, keyOffset, keyContent);

  const plainValueMatch = keyContent.match(/:\s*([^#\n"'[\]{},][^#\n]*?)\s*$/);
  if (plainValueMatch?.[1]) {
    const value = plainValueMatch[1];
    const valueStart = keyOffset + plainValueMatch.index! + plainValueMatch[0].indexOf(value);
    const trimmedValueStart = valueStart + value.length - value.trimStart().length;
    const trimmedValue = value.trim();
    if (
      trimmedValue &&
      !/^(true|false|null|~)$/i.test(trimmedValue) &&
      !/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmedValue)
    ) {
      decorations.push({ from: trimmedValueStart, to: trimmedValueStart + trimmedValue.length, decoration: yamlStringDeco });
    }
  }

  if (commentStart >= 0) {
    decorations.push({ from: lineStart + commentStart, to: lineStart + line.length, decoration: yamlCommentDeco });
  }
}

function buildJsonDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of view.visibleRanges) {
    const from = range.from;
    const to = Math.min(range.to, from + MAX_HIGHLIGHT_CHARS_PER_RANGE);
    if (to <= from) continue;

    const text = view.state.sliceDoc(from, to);
    jsonTokenPattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = jsonTokenPattern.exec(text)) !== null) {
      const decoration = decorationForJson(match);
      if (!decoration) continue;

      const start = from + match.index;
      const end = start + match[0].length;
      if (end > start) builder.add(start, end, decoration);
    }
  }

  return builder.finish();
}

function buildYamlDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const decorations: PendingDecoration[] = [];

  for (const range of view.visibleRanges) {
    const from = range.from;
    const to = Math.min(range.to, from + MAX_HIGHLIGHT_CHARS_PER_RANGE);
    if (to <= from) continue;

    const firstLine = view.state.doc.lineAt(from);
    const lastLine = view.state.doc.lineAt(to);
    for (let lineNumber = firstLine.number; lineNumber <= lastLine.number; lineNumber++) {
      const line = view.state.doc.line(lineNumber);
      const lineFrom = Math.max(line.from, from);
      const lineTo = Math.min(line.to, to);
      if (lineTo <= lineFrom) continue;

      addYamlLineDecorations(decorations, lineFrom, view.state.sliceDoc(lineFrom, lineTo));
    }
  }

  decorations.sort((a, b) => a.from - b.from || a.to - b.to);
  for (const { from, to, decoration } of decorations) {
    builder.add(from, to, decoration);
  }

  return builder.finish();
}

function buildDecorations(view: EditorView, language: Extract<EditorLanguage, 'json' | 'yaml'>): DecorationSet {
  return language === 'json' ? buildJsonDecorations(view) : buildYamlDecorations(view);
}

export function createViewportSyntaxHighlighting(language: EditorLanguage): Extension[] {
  if (language !== 'json' && language !== 'yaml') return [];
  const syntaxLanguage = language;

  return [ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view, syntaxLanguage);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view, syntaxLanguage);
      }
    }
  }, {
    decorations: (plugin) => plugin.decorations,
  })];
}
