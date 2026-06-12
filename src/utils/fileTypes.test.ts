import { describe, expect, it } from 'vitest';
import {
  getEditorLanguage,
  getFileType,
  isEditableTextFile,
  isMarkdownFile,
  isPreviewableMarkdownFile,
  supportsOutline,
} from './fileTypes';

describe('file type detection', () => {
  it('detects supported file types case-insensitively', () => {
    expect(getFileType('README.md')).toBe('markdown');
    expect(getFileType('guide.markdown')).toBe('markdown');
    expect(getFileType('package.json')).toBe('json');
    expect(getFileType('app.config.json')).toBe('json');
    expect(getFileType('config.yml')).toBe('yaml');
    expect(getFileType('config.yaml')).toBe('yaml');
    expect(getFileType('CONFIG.YAML')).toBe('yaml');
    expect(getFileType('notes.txt')).toBe('text');
    expect(getFileType('unknown.bin')).toBe('unsupported');
  });

  it('marks JSON, YAML, and Shell as editable plain text documents', () => {
    expect(isEditableTextFile('package.json')).toBe(true);
    expect(isEditableTextFile('config.yml')).toBe(true);
    expect(isEditableTextFile('config.yaml')).toBe(true);
    expect(isEditableTextFile('script.sh')).toBe(true);
    expect(isEditableTextFile('.bashrc')).toBe(true);
    expect(isEditableTextFile('__shebang_shell')).toBe(true);
  });

  it('keeps preview and outline Markdown-only', () => {
    expect(isPreviewableMarkdownFile('README.md')).toBe(true);
    expect(supportsOutline('README.md')).toBe(true);
    expect(isPreviewableMarkdownFile('package.json')).toBe(false);
    expect(isPreviewableMarkdownFile('config.yml')).toBe(false);
    expect(isPreviewableMarkdownFile('config.yaml')).toBe(false);
    expect(isPreviewableMarkdownFile('script.sh')).toBe(false);
    expect(supportsOutline('package.json')).toBe(false);
    expect(supportsOutline('config.yml')).toBe(false);
    expect(supportsOutline('config.yaml')).toBe(false);
    expect(supportsOutline('.bashrc')).toBe(false);
  });

  it('maps supported extensions to editor languages', () => {
    expect(getEditorLanguage('README.md')).toBe('markdown');
    expect(getEditorLanguage('package.json')).toBe('json');
    expect(getEditorLanguage('config.yml')).toBe('yaml');
    expect(getEditorLanguage('config.yaml')).toBe('yaml');
    expect(getEditorLanguage('CONFIG.YML')).toBe('yaml');
    expect(getEditorLanguage('unknown.txt')).toBe('text');
    expect(getEditorLanguage('deploy.sh')).toBe('shell');
    expect(getEditorLanguage('.bashrc')).toBe('shell');
    expect(getEditorLanguage('.zshrc')).toBe('shell');
    expect(getEditorLanguage('__shebang_shell')).toBe('shell');
  });

  it('keeps unknown extensions unsupported and non-markdown', () => {
    expect(getFileType('unknown.bin')).toBe('unsupported');
    expect(isEditableTextFile('unknown.bin')).toBe(false);
    expect(isMarkdownFile('unknown.bin')).toBe(false);
    
    // Extensionless files that are NOT configs or shebang should be unsupported
    expect(getFileType('random-file-no-ext')).toBe('unsupported');
    expect(isEditableTextFile('random-file-no-ext')).toBe(false);
  });

  it('recognises .mdx as a markdown file', () => {
    expect(getFileType('page.mdx')).toBe('markdown');
    expect(isMarkdownFile('page.mdx')).toBe(true);
    expect(isEditableTextFile('page.mdx')).toBe(true);
    expect(isPreviewableMarkdownFile('page.mdx')).toBe(true);
    expect(supportsOutline('page.mdx')).toBe(true);
    expect(getEditorLanguage('page.mdx')).toBe('markdown');
  });

  it('handles .mdx case-insensitively', () => {
    expect(getFileType('README.MDX')).toBe('markdown');
    expect(getFileType('Hero.Mdx')).toBe('markdown');
    expect(isMarkdownFile('DOCS.MDX')).toBe(true);
    expect(getEditorLanguage('guide.MDX')).toBe('markdown');
  });
  
  it('detects shell config files and shebang files specifically', () => {
    expect(getFileType('.bash_profile')).toBe('shell');
    expect(getFileType('.profile')).toBe('shell');
    expect(getFileType('.zshrc')).toBe('shell');
    expect(getFileType('.ZSHRC')).toBe('shell'); // Case insensitive check
    expect(getFileType('__shebang_shell')).toBe('shell');
  });
});
