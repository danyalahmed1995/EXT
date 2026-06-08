import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';

try {
  const content = "A".repeat(5000000); // 5MB
  console.log("Creating state...");
  const state = EditorState.create({
    doc: content,
    extensions: [markdown()]
  });
  console.log("Success! State created.");
} catch (e) {
  console.error("Error creating state:", e);
}
