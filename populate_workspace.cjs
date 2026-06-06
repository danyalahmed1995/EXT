const fs = require('fs');
const path = require('path');

const dir = 'd:\\AI Work\\EXT_Example_Workspace';

const welcomeMd = `# Welcome to EXT! 🚀

This is a **showcase workspace** designed to demonstrate the power of EXT as a lightweight, premium, local-first editor.

## Why EXT?

EXT is designed to be intentionally scoped:
- **Fast Local Workspaces**: Native performance thanks to Rust & Tauri.
- **Privacy First**: No cloud, no accounts, no tracking. Your files stay on your disk.
- **Premium Aesthetics**: A gorgeous UI designed to keep you focused.

### Core Features
1. **Smart Views**: Automatically aggregates files containing \`- [ ]\` or \`TODO:\`.
2. **Favorites**: Star your most important files to keep them pinned.
3. **Flexible Views**: Switch instantly between **Editor**, **Split**, and **Preview** modes using the top-right controls or shortcuts.

---
*Tip: Try adding this folder as a workspace, switch to Split View, and see your markdown beautifully rendered on the fly!*
`;

const tasksMd = `# Project Tasks

This file contains tasks to demonstrate EXT's **Smart Views** capability. Any file with open checkboxes or TODOs will automatically appear in the "Todos" smart view.

## High Priority
- [ ] Implement dark mode toggle
- [x] Refactor frontend state management
- [ ] Audit application memory usage

## Backlog
- [ ] Design custom scrollbars for Windows
- [ ] Add word count to the status bar

> TODO: Review the latest PRs before Friday.
`;

const codeSnippetsMd = `# Code Snippets

EXT utilizes robust syntax highlighting for markdown code blocks. Here are some examples of different languages:

### Rust (Backend)
\`\`\`rust
#[tauri::command]
pub fn get_sys_info() -> Result<String, String> {
    let info = sys_info::os_type().unwrap_or_default();
    Ok(format!("OS: {}", info))
}
\`\`\`

### TypeScript (Frontend)
\`\`\`typescript
interface FileItem {
  id: string;
  name: string;
  extension: string;
  absolutePath: string;
  hasTodos: boolean;
  modifiedAt: string;
}

const formatPath = (path: string): string => {
  return path.replace(/\\\\/g, '/');
};
\`\`\`

### Python (Data Processing)
\`\`\`python
def process_data(data_list):
    """Filters out none values and maps to uppercase."""
    return [str(item).upper() for item in data_list if item is not None]

print(process_data(["ext", None, "editor"]))
\`\`\`
`;

const richFormattingMd = `# Markdown Formatting Showcase

EXT renders **GitHub Flavored Markdown** seamlessly in the Preview and Split views.

## Typography
You can use *italics*, **bold**, ~~strikethrough~~, and \`inline code\`.

## Blockquotes
> The best tools are the ones that get out of your way and let you work.
> 
> — *Unknown Developer*

## Tables
| Feature | Supported | Notes |
|---------|:---:|-------|
| Markdown | Yes | GitHub Flavored |
| Plain Text | Yes | Supports .txt files |
| Cloud Sync | No | Local-first design |

## Lists
### Unordered
* Fast
* Private
* Beautiful

### Ordered
1. Add Folder
2. Edit Markdown
3. Enjoy the aesthetic

---
`;

const notesTxt = `EXT supports plain text files too!

This is a standard .txt file. It won't render as Markdown in the preview, but it will open cleanly in the editor for quick scratch notes or logs.

Use EXT for all your lightweight text editing needs.
`;

// Helper to ensure CRLF line endings
const ensureCRLF = (str) => str.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

fs.writeFileSync(path.join(dir, 'Welcome.md'), ensureCRLF(welcomeMd));
fs.writeFileSync(path.join(dir, 'Tasks.md'), ensureCRLF(tasksMd));
fs.writeFileSync(path.join(dir, 'Code_Snippets.md'), ensureCRLF(codeSnippetsMd));
fs.writeFileSync(path.join(dir, 'Rich_Formatting.md'), ensureCRLF(richFormattingMd));
fs.writeFileSync(path.join(dir, 'scratch_notes.txt'), ensureCRLF(notesTxt));

console.log('Workspace populated!');
