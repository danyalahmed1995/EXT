export type EditorLanguage = 'markdown' | 'json' | 'yaml' | 'text' | 'shell';
export type FileTypeId = EditorLanguage | 'unsupported';

interface FileTypeDefinition {
  id: EditorLanguage;
  extensions: readonly string[];
  editable: boolean;
  previewable: boolean;
  outlineSupported: boolean;
  language: EditorLanguage;
}

export const SHELL_EXTENSIONS = [
  '.sh', '.bash', '.zsh', '.fish', '.ksh', '.csh', '.tcsh'
] as const;

export const SHELL_CONFIG_FILES = [
  '.bashrc', '.bash_profile', '.bash_login', '.profile', 
  '.zshrc', '.zprofile', '.zshenv', '.zlogin', '.zlogout', '.kshrc'
] as const;

const FILE_TYPES: readonly FileTypeDefinition[] = [
  {
    id: 'markdown',
    extensions: ['.md', '.markdown', '.mdx'],
    editable: true,
    previewable: true,
    outlineSupported: true,
    language: 'markdown',
  },
  {
    id: 'json',
    extensions: ['.json'],
    editable: true,
    previewable: false,
    outlineSupported: false,
    language: 'json',
  },
  {
    id: 'yaml',
    extensions: ['.yml', '.yaml'],
    editable: true,
    previewable: false,
    outlineSupported: false,
    language: 'yaml',
  },
  {
    id: 'text',
    extensions: ['.txt'],
    editable: true,
    previewable: false,
    outlineSupported: false,
    language: 'text',
  },
  {
    id: 'shell',
    extensions: [...SHELL_EXTENSIONS, ...SHELL_CONFIG_FILES, '__shebang_shell'],
    editable: true,
    previewable: false,
    outlineSupported: false,
    language: 'shell',
  },
] as const;

export const SUPPORTED_EDITABLE_EXTENSIONS = FILE_TYPES
  .filter((type) => type.editable)
  .flatMap((type) => type.extensions);

function normalizeExtension(pathOrExtension: string): string {
  if (pathOrExtension === '__shebang_shell') return '__shebang_shell';

  const fileName = pathOrExtension.split(/[\\/]/).pop() ?? pathOrExtension;
  const lowerFileName = fileName.toLowerCase();
  
  if (SHELL_CONFIG_FILES.includes(lowerFileName as any)) {
    return lowerFileName;
  }

  if (fileName.startsWith('.') && fileName.indexOf('.', 1) === -1) {
    return fileName.toLowerCase();
  }

  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

export function getFileType(pathOrExtension: string): FileTypeId {
  const extension = normalizeExtension(pathOrExtension);
  return FILE_TYPES.find((type) => type.extensions.includes(extension))?.id ?? 'unsupported';
}

export function isEditableTextFile(pathOrExtension: string): boolean {
  const fileType = getFileType(pathOrExtension);
  return fileType !== 'unsupported';
}

export function isMarkdownFile(pathOrExtension: string): boolean {
  return getFileType(pathOrExtension) === 'markdown';
}

export function isPreviewableMarkdownFile(pathOrExtension: string): boolean {
  return isMarkdownFile(pathOrExtension);
}

export function supportsOutline(pathOrExtension: string): boolean {
  return isMarkdownFile(pathOrExtension);
}

export function getEditorLanguage(pathOrExtension: string): EditorLanguage {
  const fileType = getFileType(pathOrExtension);
  return fileType === 'unsupported' ? 'text' : fileType;
}

export function getFileTypeLabel(pathOrExtension: string): string {
  switch (getEditorLanguage(pathOrExtension)) {
    case 'markdown':
      return 'Markdown';
    case 'json':
      return 'JSON';
    case 'yaml':
      return 'YAML';
    case 'shell':
      return 'Shell Script';
    case 'text':
      return 'Text';
  }
}
