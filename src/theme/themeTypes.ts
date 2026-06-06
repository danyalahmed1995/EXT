export interface ThemeTokens {
  // Surfaces
  '--color-bg': string;
  '--color-surface': string;
  '--color-surface-elevated': string;
  '--color-surface-hover': string;
  '--color-sidebar': string;
  '--color-editor': string;
  '--color-preview': string;
  '--color-code-bg': string;

  // Text
  '--color-text-primary': string;
  '--color-text-secondary': string;
  '--color-text-muted': string;

  // Accents
  '--color-accent': string;
  '--color-accent-hover': string;
  '--color-accent-soft': string;

  // Borders
  '--color-border': string;
  '--color-border-subtle': string;

  // States
  '--color-hover': string;
  '--color-active': string;
  '--color-selection': string;

  // Semantic
  '--color-error': string;
  '--color-success': string;
  '--color-warning': string;
  '--color-info': string;

  // Syntax Highlighting
  '--color-syntax-keyword': string;
  '--color-syntax-name': string;
  '--color-syntax-function': string;
  '--color-syntax-constant': string;
  '--color-syntax-type': string;
  '--color-syntax-operator': string;
  '--color-syntax-comment': string;
  '--color-syntax-string': string;
  '--color-syntax-invalid': string;
  
  // Dynamic shadows depending on mode
  '--shadow-soft': string;
  '--shadow-panel': string;
  '--shadow-elevated': string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  author: string;
  mode: 'light' | 'dark';
  tokens: ThemeTokens;
}

export interface CustomTheme extends Theme {
  isCustom: true;
}
