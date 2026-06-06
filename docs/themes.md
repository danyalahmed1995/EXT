# EXT Theme System

EXT uses a token-based, CSS variables driven theme system. This allows the application, CodeMirror editor, and Markdown preview to be themed seamlessly without breaking core app logic or editor typing performance.

## How Themes Work

Themes are defined as static TypeScript objects containing a list of standard design tokens (CSS variables like `--color-bg`, `--color-accent`). 
When a theme is active, these variables are injected into `document.documentElement` (`:root`). All UI components, including the CodeMirror editor, read these CSS variables directly.

## Built-in Themes

EXT currently ships with several carefully crafted built-in themes:

1. **EXT Dark** (`ext-dark`): The default premium dark theme with a glassmorphism aesthetic.
2. **Material Dark Purple** (`material-dark-purple`): A solid dark theme inspired by Material Design.
3. **Material Light** (`material-light`): A clean, high-contrast light theme with a deep purple accent.
4. **Noir** (`noir`): A cinematic, high-contrast grayscale dark theme.
5. **Matrix** (`matrix`): A sci-fi terminal-inspired dark theme with green highlights.
6. **Cyberpunk** (`cyberpunk`): A dark futuristic theme with neon cyan and magenta.
7. **Paper** (`paper`): A warm off-white reading and writing light theme.

All built-in themes are located in `src/theme/themes.ts`. 
Theme types and the `ThemeTokens` interface are located in `src/theme/themeTypes.ts`.

## How to Add a New Theme

1. Open `src/theme/themes.ts`.
2. Define a new `Theme` object. You can copy an existing theme and modify the specific tokens you want to change.
3. Add your new theme to the `BUILT_IN_THEMES` array at the bottom of the file.

```ts
export const myCustomTheme: Theme = {
  id: 'my-custom-theme',
  name: 'My Theme',
  description: 'A beautiful new theme.',
  author: 'Your Name',
  mode: 'dark', // or 'light'
  tokens: {
    ...extDarkTokens, // Inherit missing tokens from a base theme
    '--color-bg': '#000000',
    '--color-surface': '#111111',
    '--color-accent': '#ff0055',
    // ... override other tokens
  }
};

export const BUILT_IN_THEMES: Theme[] = [
  extDarkTheme,
  materialDarkPurpleTheme,
  materialLightTheme,
  myCustomTheme, // <- Add here
];
```

## Important Safety Rule

> **⚠️ Theme PRs should NOT change editor behavior or app logic unless absolutely necessary.**
> 
> The theme system is designed to be completely separate from the core CodeMirror extensions and React state. Do not add `useEffect` hooks that force CodeMirror to re-render, do not alter caret absolute positioning or CSS transitions on `.cm-cursor`, and do not calculate manual string offsets for highlighting. All editor theming must be done safely through the CSS variables in `themeTypes.ts`.
