import React, { createContext, useContext, useLayoutEffect, useState, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Theme, CustomTheme } from './themeTypes';
import { BUILT_IN_THEMES, extDarkTheme } from './themes';

interface ThemeContextState {
  currentThemeId: string;
  currentTheme: Theme | CustomTheme;
  customThemes: CustomTheme[];
  setTheme: (id: string) => void;
  saveCustomTheme: (theme: CustomTheme) => void;
  deleteCustomTheme: (id: string) => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextState | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const THEME_STORAGE_KEY = 'ext_active_theme_id';
const CUSTOM_THEMES_KEY = 'ext_custom_themes';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) || extDarkTheme.id;
  });

  const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const currentTheme = useMemo(() => {
    const builtin = BUILT_IN_THEMES.find(t => t.id === currentThemeId);
    if (builtin) return builtin;
    const custom = customThemes.find(t => t.id === currentThemeId);
    if (custom) return custom;
    return extDarkTheme; // Fallback
  }, [currentThemeId, customThemes]);

  // Apply CSS Variables to :root synchronously
  useLayoutEffect(() => {
    const root = document.documentElement;
    const tokens = currentTheme.tokens;
    
    // Set theme variables
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Set a class for dark/light mode specific overrides if needed outside of tokens
    root.classList.remove('mode-dark', 'mode-light');
    root.classList.add(`mode-${currentTheme.mode}`);

    // Clean up function if needed (not strictly necessary for :root unless unmounting the whole app)
  }, [currentTheme]);

  const transitionTheme = (updateFn: () => void) => {
    // @ts-ignore - View Transitions API
    if (document.startViewTransition) {
      // @ts-ignore
      document.startViewTransition(() => {
        flushSync(() => {
          updateFn();
        });
      });
    } else {
      updateFn();
    }
  };

  const setTheme = (id: string) => {
    transitionTheme(() => {
      setCurrentThemeId(id);
    });
    localStorage.setItem(THEME_STORAGE_KEY, id);
  };

  const saveCustomTheme = (theme: CustomTheme) => {
    transitionTheme(() => {
      setCustomThemes(prev => {
        const existingIdx = prev.findIndex(t => t.id === theme.id);
        let next;
        if (existingIdx >= 0) {
          next = [...prev];
          next[existingIdx] = theme;
        } else {
          next = [...prev, theme];
        }
        localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
        return next;
      });
      setCurrentThemeId(theme.id);
    });
    localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  };

  const deleteCustomTheme = (id: string) => {
    transitionTheme(() => {
      setCustomThemes(prev => {
        const next = prev.filter(t => t.id !== id);
        localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
        return next;
      });
      if (currentThemeId === id) {
        setCurrentThemeId(extDarkTheme.id);
        localStorage.setItem(THEME_STORAGE_KEY, extDarkTheme.id);
      }
    });
  };

  const resetToDefault = () => {
    setTheme(extDarkTheme.id);
  };

  return (
    <ThemeContext.Provider value={{
      currentThemeId,
      currentTheme,
      customThemes,
      setTheme,
      saveCustomTheme,
      deleteCustomTheme,
      resetToDefault
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
