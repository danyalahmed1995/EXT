import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { EditorPanel, PRINT_MAX_SIZE_BYTES } from './EditorPanel';
import type { EditorTab } from './EditorPanel';

// Mock dependencies
vi.mock('./CodeMirrorEditor', () => ({
  CodeMirrorEditor: () => <div data-testid="codemirror-editor" />
}));

vi.mock('../preview/MarkdownPreview', () => ({
  MarkdownPreview: () => <div data-testid="markdown-preview" />,
  printMarkdownDocument: vi.fn()
}));

vi.mock('../theme/ThemeDropdown', () => ({
  ThemeDropdown: () => <div data-testid="theme-dropdown" />
}));
vi.mock('../../hooks/useGitStatus', () => ({
  useGitStatus: () => null
}));

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('EditorPanel Print Feature', () => {
  const defaultProps = {
    viewMode: 'preview' as const,
    onViewModeChange: vi.fn(),
    onTabSelect: vi.fn(),
    onTabClose: vi.fn(),
    onContentChange: vi.fn(),
    onSaveFile: vi.fn(),
    onConvertLineEnding: vi.fn(),
    onNewFile: vi.fn(),
    onOpenSettings: vi.fn()
  };

  const createTab = (id: string, extension: string, content: string, isLargeFile = false): EditorTab => ({
    id,
    name: `test${extension}`,
    extension,
    content,
    absolutePath: `/test${extension}`,
    isLargeFile
  });

  it('enables print button for normal-size .md files', () => {
    const tab = createTab('1', '.md', '# Hello World');
    render(<EditorPanel {...defaultProps} tabs={[tab]} activeTabId="1" />);
    
    const printBtn = screen.getByTestId('print-button');
    expect(printBtn).toBeInTheDocument();
    expect(printBtn).not.toBeDisabled();
    expect(printBtn.getAttribute('title')).toBe('Print Preview');
  });

  it('enables print button for normal-size .mdx files', () => {
    const tab = createTab('1', '.mdx', '# Hello MDX');
    render(<EditorPanel {...defaultProps} tabs={[tab]} activeTabId="1" />);
    
    const printBtn = screen.getByTestId('print-button');
    expect(printBtn).toBeInTheDocument();
    expect(printBtn).not.toBeDisabled();
  });

  it('disables print button and shows helpful tooltip for Markdown files above print size threshold', () => {
    // Generate a string larger than 1.5MB
    const largeContent = 'A'.repeat(PRINT_MAX_SIZE_BYTES + 10);
    const tab = createTab('1', '.md', largeContent);
    render(<EditorPanel {...defaultProps} tabs={[tab]} activeTabId="1" />);
    
    const printBtn = screen.getByTestId('print-button');
    expect(printBtn).toBeInTheDocument();
    expect(printBtn).toBeDisabled();
    expect(printBtn.getAttribute('title')).toContain('Printing is disabled for very large files');
  });

  it('does not show print button for non-preview file types', () => {
    const tab = createTab('1', '.txt', 'Hello Text');
    render(<EditorPanel {...defaultProps} tabs={[tab]} activeTabId="1" />);
    
    const printBtn = screen.queryByTestId('print-button');
    expect(printBtn).not.toBeInTheDocument();
  });

  it('does not show print button for files in Large File Mode', () => {
    // Even if it is a .md file, if it hit the large file mode (e.g. >20MB)
    const tab = createTab('1', '.md', '', true);
    render(<EditorPanel {...defaultProps} tabs={[tab]} activeTabId="1" />);
    
    const printBtn = screen.queryByTestId('print-button');
    expect(printBtn).not.toBeInTheDocument();
  });
});
