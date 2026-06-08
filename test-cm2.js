import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

try {
  const content = "A".repeat(5000000); // 5MB
  console.log("Creating state...");
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ codeLanguages: languages })]
  });
  console.log("Success! State created.");
} catch (e) {
  console.error("Error creating state:", e);
}
