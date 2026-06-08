import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

const doc = "a".repeat(5000000);

console.time('no-markdown');
EditorState.create({ doc, extensions: [] });
console.timeEnd('no-markdown');

console.time('markdown-no-lang');
EditorState.create({ doc, extensions: [markdown()] });
console.timeEnd('markdown-no-lang');

import { ViewPlugin, Decoration, MatchDecorator } from '@codemirror/view';

const hugeMarkdownDecorator = new MatchDecorator({
  regexp: /(?:^|\s)(\*\*.*?\*\*|__.*?__|`[^`\n]+`|^#+\s.*$|^\s*[-*+]\s.*$)/gm,
  decoration: (match) => Decoration.mark({})
});
const hugeMarkdownSyntaxPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = hugeMarkdownDecorator.createDeco(view); }
  update(update) { this.decorations = hugeMarkdownDecorator.updateDeco(update, this.decorations); }
}, { decorations: v => v.decorations });

import { ChangeSet } from '@codemirror/state';

function applyChangesToString(content, changes) {
  let next = '';
  let position = 0;
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    next += content.slice(position, fromA);
    next += inserted.toString();
    position = toA;
  });
  next += content.slice(position);
  return next;
}

const state = EditorState.create({ doc, extensions: [] });
const changes = state.changes({ from: 100, insert: 'hello' });
const newState = state.update({ changes }).state;

console.time('applyChangesToString');
applyChangesToString(doc, changes);
console.timeEnd('applyChangesToString');

console.time('doc.toString()');
newState.doc.toString();
console.timeEnd('doc.toString()');
