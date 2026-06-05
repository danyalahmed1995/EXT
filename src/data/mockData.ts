// ── Mock Data for EXT UI Prototype ─────────────────────────

export interface MockWorkspace {
  id: string;
  name: string;
  path: string;
  detectedIcon: string;
}

export interface MockFile {
  id: string;
  workspaceId: string;
  name: string;
  extension: string;
  workspace: string;
  relativePath: string;
  modifiedAt: string;
  size: number;
  isFavorite: boolean;
  isPinned: boolean;
  content: string;
}

// ── Workspaces ────────────────────────────────────────────

export const mockWorkspaces: MockWorkspace[] = [
  {
    id: 'ws-1',
    name: 'react-dashboard',
    path: 'D:/GitHub/react-dashboard',
    detectedIcon: 'typescript',
  },
  {
    id: 'ws-2',
    name: 'ml-pipeline',
    path: 'D:/Projects/ml-pipeline',
    detectedIcon: 'python',
  },
  {
    id: 'ws-3',
    name: 'ext',
    path: 'D:/GitHub/ext',
    detectedIcon: 'rust',
  },
  {
    id: 'ws-4',
    name: 'oss-prompts',
    path: 'D:/Notes/oss-prompts',
    detectedIcon: 'prompt',
  },
  {
    id: 'ws-5',
    name: 'crash-reports',
    path: 'D:/Logs/crash-reports',
    detectedIcon: 'bug',
  },
  {
    id: 'ws-6',
    name: 'project-docs',
    path: 'D:/Docs/project-docs',
    detectedIcon: 'markdown',
  },
];

// ── Demo Markdown Content ─────────────────────────────────

const DEMO_MARKDOWN = `# React Dashboard

A modern analytics dashboard built with **React 19**, **TypeScript**, and **Recharts**.

## Features

- 📊 Real-time data visualization
- 🌙 Dark mode support
- 📱 Responsive layout
- ⚡ WebSocket live updates

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Architecture

The app follows a modular component architecture:

\`\`\`typescript
// Example: Dashboard Widget
interface WidgetProps {
  title: string;
  data: DataPoint[];
  variant: 'chart' | 'metric' | 'table';
}

export const Widget: React.FC<WidgetProps> = ({ title, data, variant }) => {
  return (
    <div className="widget">
      <h3>{title}</h3>
      <WidgetContent data={data} variant={variant} />
    </div>
  );
};
\`\`\`

## Data Sources

| Source | Type | Refresh Rate |
|--------|------|-------------|
| Analytics API | REST | 30s |
| User Events | WebSocket | Real-time |
| Reports | GraphQL | On-demand |
| Metrics | gRPC | 5s |

## Roadmap

- [x] Core dashboard layout
- [x] Chart components
- [ ] Export to PDF
- [ ] Custom widget builder
- [ ] Team sharing

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

> **Note**: This project uses strict TypeScript mode. Please ensure all types are properly defined.

---

*Built with ❤️ by the Dashboard Team*
`;

// ── Files ─────────────────────────────────────────────────

export const mockFiles: MockFile[] = [
  {
    id: 'f-1',
    workspaceId: 'ws-1',
    name: 'README.md',
    extension: '.md',
    workspace: 'react-dashboard',
    relativePath: 'README.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    size: 4200,
    isFavorite: true,
    isPinned: false,
    content: DEMO_MARKDOWN,
  },
  {
    id: 'f-2',
    workspaceId: 'ws-1',
    name: 'CHANGELOG.md',
    extension: '.md',
    workspace: 'react-dashboard',
    relativePath: 'CHANGELOG.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
    size: 2800,
    isFavorite: false,
    isPinned: false,
    content: `# Changelog

## [0.3.0] - 2026-06-01

### Added
- Dark mode toggle in settings panel
- Export dashboard as PNG
- Real-time WebSocket data feed

### Fixed
- Chart tooltip positioning on mobile
- Memory leak in data polling hook

## [0.2.0] - 2026-05-15

### Added
- New analytics dashboard widget
- User activity heatmap
- CSV data import

### Changed
- Migrated from Chart.js to Recharts
- Updated React to v19
`,
  },
  {
    id: 'f-3',
    workspaceId: 'ws-2',
    name: 'architecture.md',
    extension: '.md',
    workspace: 'ml-pipeline',
    relativePath: 'docs/architecture.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5h ago
    size: 6100,
    isFavorite: true,
    isPinned: true,
    content: `# ML Pipeline Architecture

## Overview

The pipeline consists of three main stages:

1. **Data Ingestion** — Pulls from S3, BigQuery, and local CSVs
2. **Feature Engineering** — Transforms and normalizes features
3. **Model Training** — Distributed training with PyTorch

## Data Flow

\`\`\`
S3 Bucket → Ingestion Service → Feature Store → Training Cluster → Model Registry
\`\`\`

## Key Components

| Component | Language | Status |
|-----------|----------|--------|
| Ingestion | Python | ✅ Done |
| Feature Store | Python/SQL | ✅ Done |
| Training | Python/CUDA | 🔄 In Progress |
| Serving | Rust | 📋 Planned |

## TODO

- [ ] Add data validation step
- [ ] Implement A/B test framework
- [x] Set up model versioning
- [x] Add monitoring dashboards
- [ ] Write integration tests
`,
  },
  {
    id: 'f-4',
    workspaceId: 'ws-3',
    name: 'CONTRIBUTING.md',
    extension: '.md',
    workspace: 'ext',
    relativePath: 'CONTRIBUTING.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    size: 3200,
    isFavorite: false,
    isPinned: false,
    content: `# Contributing to EXT

Thanks for your interest in contributing to EXT!

## Getting Started

1. Fork the repo
2. Clone your fork
3. Install dependencies: \`npm install\`
4. Run dev server: \`npm run tauri dev\`

## Code Style

- Use TypeScript strict mode
- Follow Rust formatting with \`cargo fmt\`
- Use CSS variables from \`tokens.css\`

## Pull Requests

- Create a feature branch from \`main\`
- Write descriptive commit messages
- Add tests for new features
- Update documentation if needed

> **Note**: All contributions are licensed under the MIT license.
`,
  },
  {
    id: 'f-5',
    workspaceId: 'ws-4',
    name: 'code-review-prompt.md',
    extension: '.md',
    workspace: 'oss-prompts',
    relativePath: 'code-review-prompt.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3h ago
    size: 1800,
    isFavorite: true,
    isPinned: false,
    content: `# Code Review Prompt

You are a senior code reviewer. Review the following code for:

## Checklist

- [ ] **Correctness** — Does it do what it claims?
- [ ] **Security** — Any injection, XSS, or auth issues?
- [ ] **Performance** — N+1 queries, unnecessary allocations?
- [ ] **Readability** — Clear naming, good structure?
- [ ] **Tests** — Are edge cases covered?

## Output Format

\`\`\`
### Summary
[One line summary]

### Issues Found
1. [Issue description] — Severity: [High/Medium/Low]

### Suggestions
- [Improvement idea]
\`\`\`
`,
  },
  {
    id: 'f-6',
    workspaceId: 'ws-4',
    name: 'system-design-prompt.md',
    extension: '.md',
    workspace: 'oss-prompts',
    relativePath: 'system-design-prompt.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8h ago
    size: 2400,
    isFavorite: false,
    isPinned: false,
    content: `# System Design Prompt

Design a system that handles [requirement]. Consider:

## Functional Requirements
- Requirement 1
- Requirement 2

## Non-Functional Requirements
- **Latency**: < 100ms p99
- **Throughput**: 10k requests/second
- **Availability**: 99.9%

## Components to Address
1. API Gateway
2. Service layer
3. Data storage
4. Caching strategy
5. Message queues
`,
  },
  {
    id: 'f-7',
    workspaceId: 'ws-5',
    name: 'crash-2026-06-01.txt',
    extension: '.txt',
    workspace: 'crash-reports',
    relativePath: 'crash-2026-06-01.txt',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    size: 890,
    isFavorite: false,
    isPinned: false,
    content: `CRASH REPORT — 2026-06-01 14:32:07 UTC

Application: ext v0.1.0
Platform: Windows 11
Architecture: x86_64

Stack Trace:
  at FileScanner::scan_directory (scanner.rs:142)
  at WorkspaceManager::add_workspace (workspace.rs:87)
  at tauri::command::handle (lib.rs:34)

Error: Permission denied: "C:\\Users\\test\\AppData"
Cause: Attempted to scan system directory without permission check

Resolution: Added permission check before scanning. Skip directories that return AccessDenied.
`,
  },
  {
    id: 'f-8',
    workspaceId: 'ws-5',
    name: 'error-log-analysis.md',
    extension: '.md',
    workspace: 'crash-reports',
    relativePath: 'error-log-analysis.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    size: 1500,
    isFavorite: false,
    isPinned: false,
    content: `# Error Log Analysis

## Summary

Analyzed 47 crash reports from the last 30 days.

## Top Errors

| Error | Count | Severity |
|-------|-------|----------|
| Permission denied | 12 | Medium |
| File not found | 8 | Low |
| Timeout | 6 | High |
| OOM | 3 | Critical |

## Recommendations

1. **Add retry logic** for transient failures
2. **Increase timeout** from 5s to 15s for large scans
3. **Add memory limits** for file preview rendering
`,
  },
  {
    id: 'f-9',
    workspaceId: 'ws-6',
    name: 'getting-started.md',
    extension: '.md',
    workspace: 'project-docs',
    relativePath: 'getting-started.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
    size: 3800,
    isFavorite: false,
    isPinned: false,
    content: `# Getting Started

Welcome to the project! This guide will help you set up your development environment.

## Prerequisites

- Node.js 18+
- Rust toolchain
- Git

## Installation

\`\`\`bash
git clone https://github.com/example/project.git
cd project
npm install
\`\`\`

## Running

\`\`\`bash
npm run tauri dev
\`\`\`

## Project Structure

\`\`\`
src/           — React frontend
src-tauri/     — Rust backend
public/        — Static assets
\`\`\`

## Next Steps

- Read the [Architecture Guide](./architecture.md)
- Check the [Contributing Guide](./CONTRIBUTING.md)
- Browse open [issues](https://github.com/example/project/issues)
`,
  },
  {
    id: 'f-10',
    workspaceId: 'ws-6',
    name: 'api-reference.md',
    extension: '.md',
    workspace: 'project-docs',
    relativePath: 'api-reference.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12h ago
    size: 5200,
    isFavorite: true,
    isPinned: false,
    content: `# API Reference

## Tauri Commands

### \`add_workspace(path: string)\`

Adds a folder to the workspace index.

**Parameters:**
- \`path\` — Absolute path to the folder

**Returns:** \`Workspace\` object

**Errors:**
- \`FOLDER_NOT_FOUND\` — Path does not exist
- \`DUPLICATE_WORKSPACE\` — Already added

---

### \`list_files(filter: FileFilter)\`

Lists indexed files matching the filter.

**Parameters:**
- \`filter.workspace_id\` — Optional workspace ID
- \`filter.extension\` — Optional file extension
- \`filter.search\` — Optional search query

**Returns:** \`File[]\`
`,
  },
  {
    id: 'f-11',
    workspaceId: 'ws-2',
    name: 'requirements.txt',
    extension: '.txt',
    workspace: 'ml-pipeline',
    relativePath: 'requirements.txt',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    size: 340,
    isFavorite: false,
    isPinned: false,
    content: `torch==2.3.0
numpy==1.26.4
pandas==2.2.1
scikit-learn==1.4.1
boto3==1.34.0
sqlalchemy==2.0.28
pydantic==2.6.0
fastapi==0.110.0
uvicorn==0.27.0
pytest==8.0.0
black==24.2.0
mypy==1.8.0
`,
  },
  {
    id: 'f-12',
    workspaceId: 'ws-1',
    name: 'notes.txt',
    extension: '.txt',
    workspace: 'react-dashboard',
    relativePath: 'notes.txt',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2h ago
    size: 520,
    isFavorite: false,
    isPinned: false,
    content: `Dashboard TODO:
- Fix chart rendering on Safari
- Add dark mode persistence
- TODO: Investigate WebSocket reconnection logic
- Update color palette to match new brand guidelines
- Performance: lazy load chart components
- [ ] Add loading skeletons
- [ ] Write E2E tests for dashboard filters
`,
  },
  {
    id: 'f-13',
    workspaceId: 'ws-3',
    name: 'design-notes.md',
    extension: '.md',
    workspace: 'ext',
    relativePath: 'docs/design-notes.md',
    modifiedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
    size: 2100,
    isFavorite: true,
    isPinned: true,
    content: `# EXT Design Notes

## Visual Direction

Material dark theme + macOS-like controls + premium editor surface.

### Color Palette
- Background: Deep charcoal (#0f0f14)
- Accent: Purple/indigo (#7c5cfc)
- Text: Soft white (#e2e2e9)

### Key Decisions
1. **No WYSIWYG** — Keep it as a code editor with preview
2. **Local-first** — Never copy files into app storage
3. **CSS Variables** — Easy theming for contributors
4. **CodeMirror 6** — Better for Markdown than Monaco

## TODO
- [ ] Finalize icon set
- [x] Choose font stack (Inter + JetBrains Mono)
- [x] Define spacing scale
- [ ] Add animation guidelines
`,
  },
];



// ── Smart View Counts ─────────────────────────────────────

export const mockSmartViewCounts = {
  recent: 5,
  favorites: 4,
  allMarkdown: 11,
  allText: 2,
  modifiedToday: 4,
  todos: 6,
};
