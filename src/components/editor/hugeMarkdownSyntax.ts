import { ViewPlugin, Decoration, DecorationSet, MatchDecorator, EditorView } from '@codemirror/view';

const headerDeco = Decoration.mark({ class: 'cm-huge-header' });
const listDeco = Decoration.mark({ class: 'cm-huge-list' });
const codeDeco = Decoration.mark({ class: 'cm-huge-code' });
const strongDeco = Decoration.mark({ class: 'cm-huge-strong' });
const emDeco = Decoration.mark({ class: 'cm-huge-em' });
const linkDeco = Decoration.mark({ class: 'cm-huge-link' });

const hugeMarkdownDecorator = new MatchDecorator({
  regexp: /(^#+\s.*$)|(^\s*[-*+]\s.*$)|(`[^`\n]+`)|(\*\*.*?\*\*|__.*?__)|(\*.*?\*|_.*?_)|(\[.*?\]\(.*?\))/gm,
  decoration: (match) => {
    if (match[1]) return headerDeco;
    if (match[2]) return listDeco;
    if (match[3]) return codeDeco;
    if (match[4]) return strongDeco;
    if (match[5]) return emDeco;
    if (match[6]) return linkDeco;
    return Decoration.mark({});
  }
});

export const hugeMarkdownSyntaxPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) {
    this.decorations = hugeMarkdownDecorator.createDeco(view);
  }
  update(update: any) {
    this.decorations = hugeMarkdownDecorator.updateDeco(update, this.decorations);
  }
}, {
  decorations: v => v.decorations
});
