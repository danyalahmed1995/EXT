import { Theme, ThemeTokens } from './themeTypes';

const commonShadowsDark = {
  '--shadow-soft': '0 4px 12px rgba(0, 0, 0, 0.15)',
  '--shadow-panel': '0 8px 24px rgba(0, 0, 0, 0.25)',
  '--shadow-elevated': '0 12px 40px rgba(0, 0, 0, 0.4)',
};

const commonShadowsLight = {
  '--shadow-soft': '0 2px 8px rgba(0, 0, 0, 0.06)',
  '--shadow-panel': '0 4px 16px rgba(0, 0, 0, 0.08)',
  '--shadow-elevated': '0 8px 32px rgba(0, 0, 0, 0.1)',
};

const commonSemantic = {
  '--color-error': '#f5546a',
  '--color-success': '#4dd695',
  '--color-warning': '#f5a623',
  '--color-info': '#5db8f5',
};

const extDarkTokens: ThemeTokens = {
  '--color-bg': '#0f0f14',
  '--color-surface': 'rgba(22, 22, 30, 0.45)',
  '--color-surface-elevated': 'rgba(28, 28, 39, 0.65)',
  '--color-surface-hover': 'rgba(34, 34, 46, 0.5)',
  '--color-sidebar': 'rgba(19, 19, 25, 0.35)',
  '--color-editor': 'rgba(22, 22, 30, 0.35)',
  '--color-preview': 'rgba(22, 22, 30, 0.35)',
  '--color-code-bg': 'rgba(34, 34, 46, 0.5)',

  '--color-text-primary': '#e2e2e9',
  '--color-text-secondary': '#a0a0b0',
  '--color-text-muted': '#606075',

  '--color-accent': '#7c5cfc',
  '--color-accent-hover': '#8d70ff',
  '--color-accent-soft': 'rgba(124, 92, 252, 0.12)',

  '--color-border': '#2a2a3a',
  '--color-border-subtle': '#1f1f2e',

  '--color-hover': 'rgba(255, 255, 255, 0.04)',
  '--color-active': 'rgba(124, 92, 252, 0.15)',
  '--color-selection': 'rgba(124, 92, 252, 0.25)',

  ...commonSemantic,

  '--color-syntax-keyword': '#c792ea',
  '--color-syntax-name': '#e2e2e9',
  '--color-syntax-function': '#82aaff',
  '--color-syntax-constant': '#f78c6c',
  '--color-syntax-type': '#ffcb6b',
  '--color-syntax-operator': '#89ddff',
  '--color-syntax-comment': '#606075',
  '--color-syntax-string': '#c3e88d',
  '--color-syntax-invalid': '#f5546a',

  ...commonShadowsDark,
};

export const extDarkTheme: Theme = {
  id: 'ext-dark',
  name: 'EXT Dark',
  description: 'Default dark theme for EXT with a glassmorphism aesthetic.',
  author: 'EXT',
  mode: 'dark',
  tokens: extDarkTokens,
};

export const materialDarkPurpleTheme: Theme = {
  id: 'material-dark-purple',
  name: 'Material Dark Purple',
  description: 'A solid dark theme inspired by Material Design with deep purple surfaces.',
  author: 'EXT',
  mode: 'dark',
  tokens: {
    ...extDarkTokens,
    '--color-bg': '#121218',
    '--color-surface': '#1c1c24',
    '--color-surface-elevated': '#252530',
    '--color-surface-hover': '#2d2d3b',
    '--color-sidebar': '#16161d',
    '--color-editor': '#1a1a21',
    '--color-preview': '#1c1c24',
    '--color-hover': 'rgba(255, 255, 255, 0.08)',
    '--color-border': '#343446',
    '--color-border-subtle': '#252530',
  },
};

export const materialLightTheme: Theme = {
  id: 'material-light',
  name: 'Material Light',
  description: 'A clean, high-contrast light theme with a deep purple accent.',
  author: 'EXT',
  mode: 'light',
  tokens: {
    '--color-bg': '#f5f5f8',
    '--color-surface': '#ffffff',
    '--color-surface-elevated': '#ffffff',
    '--color-surface-hover': '#f0f0f4',
    '--color-sidebar': '#f0f0f5',
    '--color-editor': '#ffffff',
    '--color-preview': '#fafafa',
    '--color-code-bg': '#f0f0f4',

    '--color-text-primary': '#1a1a2e',
    '--color-text-secondary': '#4a4a5e',
    '--color-text-muted': '#8a8a9e',

    '--color-accent': '#6b4fcf',
    '--color-accent-hover': '#7a5ee0',
    '--color-accent-soft': 'rgba(107, 79, 207, 0.08)',

    '--color-border': '#e0e0e8',
    '--color-border-subtle': '#eaeaf0',

    '--color-hover': 'rgba(0, 0, 0, 0.03)',
    '--color-active': 'rgba(107, 79, 207, 0.1)',
    '--color-selection': 'rgba(107, 79, 207, 0.15)',

    ...commonSemantic,

    // High contrast syntax colors for light backgrounds
    '--color-syntax-keyword': '#7a3e9d',
    '--color-syntax-name': '#1a1a2e',
    '--color-syntax-function': '#005cc5',
    '--color-syntax-constant': '#d73a49',
    '--color-syntax-type': '#e36209',
    '--color-syntax-operator': '#005cc5',
    '--color-syntax-comment': '#6a737d',
    '--color-syntax-string': '#22863a',
    '--color-syntax-invalid': '#b31d28',

    ...commonShadowsLight,
  },
};

export const noirTheme: Theme = {
  id: 'noir',
  name: 'Noir',
  description: 'A cinematic, high-contrast grayscale theme.',
  author: 'EXT',
  mode: 'dark',
  tokens: {
    ...extDarkTokens,
    '--color-bg': '#0a0a0a',
    '--color-surface': '#141414',
    '--color-surface-elevated': '#1e1e1e',
    '--color-surface-hover': '#282828',
    '--color-sidebar': '#101010',
    '--color-editor': '#0f0f0f',
    '--color-preview': '#121212',
    '--color-code-bg': '#1a1a1a',

    '--color-text-primary': '#f0f0f0',
    '--color-text-secondary': '#a3a3a3',
    '--color-text-muted': '#737373',

    '--color-accent': '#d4d4d8',
    '--color-accent-hover': '#ffffff',
    '--color-accent-soft': 'rgba(212, 212, 216, 0.1)',

    '--color-border': '#262626',
    '--color-border-subtle': '#171717',

    '--color-hover': 'rgba(255, 255, 255, 0.05)',
    '--color-active': 'rgba(212, 212, 216, 0.15)',
    '--color-selection': 'rgba(255, 255, 255, 0.15)',

    '--color-syntax-keyword': '#d4d4d8',
    '--color-syntax-name': '#f0f0f0',
    '--color-syntax-function': '#a3a3a3',
    '--color-syntax-constant': '#e5e5e5',
    '--color-syntax-type': '#c4c4c4',
    '--color-syntax-operator': '#737373',
    '--color-syntax-comment': '#525252',
    '--color-syntax-string': '#9ca3af',
    '--color-syntax-invalid': '#ef4444',
  },
};

export const matrixTheme: Theme = {
  id: 'matrix',
  name: 'Matrix',
  description: 'Sci-fi terminal inspired theme with green highlights.',
  author: 'EXT',
  mode: 'dark',
  tokens: {
    ...extDarkTokens,
    '--color-bg': '#020a04',
    '--color-surface': '#041208',
    '--color-surface-elevated': '#071f0d',
    '--color-surface-hover': '#0a2e14',
    '--color-sidebar': '#030d06',
    '--color-editor': '#020c04',
    '--color-preview': '#030e06',
    '--color-code-bg': '#05180a',

    '--color-text-primary': '#dcfce7',
    '--color-text-secondary': '#86efac',
    '--color-text-muted': '#15803d',

    '--color-accent': '#22c55e',
    '--color-accent-hover': '#4ade80',
    '--color-accent-soft': 'rgba(34, 197, 94, 0.15)',

    '--color-border': '#064e3b',
    '--color-border-subtle': '#022c22',

    '--color-hover': 'rgba(34, 197, 94, 0.1)',
    '--color-active': 'rgba(34, 197, 94, 0.2)',
    '--color-selection': 'rgba(34, 197, 94, 0.25)',

    '--color-syntax-keyword': '#86efac',
    '--color-syntax-name': '#4ade80',
    '--color-syntax-function': '#bbf7d0',
    '--color-syntax-constant': '#22c55e',
    '--color-syntax-type': '#86efac',
    '--color-syntax-operator': '#16a34a',
    '--color-syntax-comment': '#14532d',
    '--color-syntax-string': '#a7f3d0',
    '--color-syntax-invalid': '#f87171',
  },
};

export const cyberpunkTheme: Theme = {
  id: 'cyberpunk',
  name: 'Cyberpunk',
  description: 'A dark futuristic theme with neon cyan and magenta.',
  author: 'EXT',
  mode: 'dark',
  tokens: {
    ...extDarkTokens,
    '--color-bg': '#090914',
    '--color-surface': '#121226',
    '--color-surface-elevated': '#1a1a36',
    '--color-surface-hover': '#25254a',
    '--color-sidebar': '#0c0c1b',
    '--color-editor': '#0b0b18',
    '--color-preview': '#0d0d1e',
    '--color-code-bg': '#16162e',

    '--color-text-primary': '#e2e8f0',
    '--color-text-secondary': '#94a3b8',
    '--color-text-muted': '#475569',

    '--color-accent': '#22d3ee',
    '--color-accent-hover': '#67e8f9',
    '--color-accent-soft': 'rgba(34, 211, 238, 0.15)',

    '--color-border': '#312e81',
    '--color-border-subtle': '#1e1b4b',

    '--color-hover': 'rgba(244, 63, 94, 0.1)',
    '--color-active': 'rgba(244, 63, 94, 0.2)',
    '--color-selection': 'rgba(244, 63, 94, 0.3)',

    '--color-syntax-keyword': '#f43f5e',
    '--color-syntax-name': '#e2e8f0',
    '--color-syntax-function': '#22d3ee',
    '--color-syntax-constant': '#a855f7',
    '--color-syntax-type': '#facc15',
    '--color-syntax-operator': '#fb923c',
    '--color-syntax-comment': '#475569',
    '--color-syntax-string': '#4ade80',
    '--color-syntax-invalid': '#ef4444',
  },
};

export const paperTheme: Theme = {
  id: 'paper',
  name: 'Paper',
  description: 'A warm off-white reading and writing theme.',
  author: 'EXT',
  mode: 'light',
  tokens: {
    ...commonSemantic,
    ...commonShadowsLight,
    '--color-bg': '#f4ecd8',
    '--color-surface': '#e8ddc3',
    '--color-surface-elevated': '#efe5cd',
    '--color-surface-hover': '#d8ccae',
    '--color-sidebar': '#ebe0c7',
    '--color-editor': '#f4ecd8',
    '--color-preview': '#f0e7d0',
    '--color-code-bg': '#e3d6bc',

    '--color-text-primary': '#3b3127',
    '--color-text-secondary': '#5c4e40',
    '--color-text-muted': '#827263',

    '--color-accent': '#b93939',
    '--color-accent-hover': '#942a2a',
    '--color-accent-soft': 'rgba(185, 57, 57, 0.1)',

    '--color-border': '#d3c4a8',
    '--color-border-subtle': '#e3d4b6',

    '--color-hover': 'rgba(0, 0, 0, 0.05)',
    '--color-active': 'rgba(185, 57, 57, 0.12)',
    '--color-selection': 'rgba(185, 57, 57, 0.18)',

    '--color-syntax-keyword': '#4f46e5',
    '--color-syntax-name': '#433d38',
    '--color-syntax-function': '#0284c7',
    '--color-syntax-constant': '#b45309',
    '--color-syntax-type': '#c026d3',
    '--color-syntax-operator': '#0f766e',
    '--color-syntax-comment': '#a8a29e',
    '--color-syntax-string': '#15803d',
    '--color-syntax-invalid': '#e11d48',
  },
};

export const gruvboxTheme: Theme = {
  id: 'gruvbox',
  name: 'Gruvbox',
  description: 'Warm, retro groove color scheme.',
  author: 'EXT',
  mode: 'dark',
  tokens: {
    ...extDarkTokens,
    '--color-bg': '#282828',
    '--color-surface': '#3c3836',
    '--color-surface-elevated': '#504945',
    '--color-surface-hover': '#665c54',
    '--color-sidebar': '#32302f',
    '--color-editor': '#282828',
    '--color-preview': '#282828',
    '--color-code-bg': '#3c3836',

    '--color-text-primary': '#ebdbb2',
    '--color-text-secondary': '#a89984',
    '--color-text-muted': '#928374',

    '--color-accent': '#fabd2f',
    '--color-accent-hover': '#d79921',
    '--color-accent-soft': 'rgba(250, 189, 47, 0.15)',

    '--color-border': '#504945',
    '--color-border-subtle': '#3c3836',

    '--color-hover': 'rgba(235, 219, 178, 0.05)',
    '--color-active': 'rgba(250, 189, 47, 0.15)',
    '--color-selection': 'rgba(250, 189, 47, 0.25)',

    '--color-syntax-keyword': '#fb4934',
    '--color-syntax-name': '#ebdbb2',
    '--color-syntax-function': '#b8bb26',
    '--color-syntax-constant': '#d3869b',
    '--color-syntax-type': '#fabd2f',
    '--color-syntax-operator': '#8ec07c',
    '--color-syntax-comment': '#928374',
    '--color-syntax-string': '#b8bb26',
    '--color-syntax-invalid': '#cc241d',
  },
};

export const gruvboxGlassTheme: Theme = {
  id: 'gruvbox-glass',
  name: 'Gruvbox Glass',
  description: 'A translucent, glassmorphic take on the Gruvbox palette.',
  author: 'EXT',
  mode: 'dark',
  tokens: {
    ...extDarkTokens,
    '--color-bg': '#1d2021',
    '--color-surface': 'rgba(60, 56, 54, 0.45)',
    '--color-surface-elevated': 'rgba(80, 73, 69, 0.65)',
    '--color-surface-hover': 'rgba(102, 92, 84, 0.5)',
    '--color-sidebar': 'rgba(40, 40, 40, 0.35)',
    '--color-editor': 'rgba(40, 40, 40, 0.35)',
    '--color-preview': 'rgba(40, 40, 40, 0.35)',
    '--color-code-bg': 'rgba(60, 56, 54, 0.5)',

    '--color-text-primary': '#ebdbb2',
    '--color-text-secondary': '#a89984',
    '--color-text-muted': '#928374',

    '--color-accent': '#fabd2f',
    '--color-accent-hover': '#d79921',
    '--color-accent-soft': 'rgba(250, 189, 47, 0.12)',

    '--color-border': 'rgba(80, 73, 69, 0.6)',
    '--color-border-subtle': 'rgba(60, 56, 54, 0.4)',

    '--color-hover': 'rgba(235, 219, 178, 0.04)',
    '--color-active': 'rgba(250, 189, 47, 0.15)',
    '--color-selection': 'rgba(250, 189, 47, 0.25)',

    '--color-syntax-keyword': '#fb4934',
    '--color-syntax-name': '#ebdbb2',
    '--color-syntax-function': '#b8bb26',
    '--color-syntax-constant': '#d3869b',
    '--color-syntax-type': '#fabd2f',
    '--color-syntax-operator': '#8ec07c',
    '--color-syntax-comment': '#928374',
    '--color-syntax-string': '#b8bb26',
    '--color-syntax-invalid': '#cc241d',
  },
};

export const BUILT_IN_THEMES: Theme[] = [
  extDarkTheme,
  materialDarkPurpleTheme,
  materialLightTheme,
  noirTheme,
  matrixTheme,
  cyberpunkTheme,
  paperTheme,
  gruvboxTheme,
  gruvboxGlassTheme,
];
