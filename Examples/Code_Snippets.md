# Code Snippets

EXT utilizes robust syntax highlighting for markdown code blocks. Here are some examples of different languages:

### Rust (Backend)
```rust
#[tauri::command]
pub fn get_sys_info() -> Result<String, String> {
    let info = sys_info::os_type().unwrap_or_default();
    Ok(format!("OS: {}", info))
}
```

### TypeScript (Frontend)
```typescript
interface FileItem {
  id: string;
  name: string;
  extension: string;
  absolutePath: string;
  hasTodos: boolean;
  modifiedAt: string;
}

const formatPath = (path: string): string => {
  return path.replace(/\\/g, '/');
};
```

### Python (Data Processing)
```python
def process_data(data_list):
    """Filters out none values and maps to uppercase."""
    return [str(item).upper() for item in data_list if item is not None]

print(process_data(["ext", None, "editor"]))
```
