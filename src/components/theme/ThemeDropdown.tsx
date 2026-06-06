import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import { BUILT_IN_THEMES } from '../../theme/themes';
import './ThemeDropdown.css';

export const ThemeDropdown: React.FC = () => {
  const { currentThemeId, currentTheme, customThemes, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const filteredBuiltIn = BUILT_IN_THEMES.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const filteredCustom = customThemes.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="theme-dropdown-container" ref={dropdownRef}>
      <button 
        className={`editor-action-btn theme-dropdown-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Switch Theme"
      >
        <span className="theme-trigger-dot" style={{ background: currentTheme.tokens['--color-accent'] }} />
        <span className="theme-trigger-name">{currentTheme.name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="theme-dropdown-popover">
          <div className="theme-dropdown-search">
            <input 
              type="text" 
              placeholder="Search themes..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              autoFocus
            />
          </div>
          
          <div className="theme-dropdown-list">
            {filteredBuiltIn.length > 0 && (
              <>
                <div className="theme-dropdown-group">Built-in Themes</div>
                {filteredBuiltIn.map(t => (
                  <button 
                    key={t.id} 
                    className={`theme-dropdown-item ${t.id === currentThemeId ? 'selected' : ''}`}
                    onClick={() => {
                      setTheme(t.id);
                      setIsOpen(false);
                    }}
                  >
                    <span className="theme-item-dot" style={{ background: t.tokens['--color-accent'] }} />
                    <span className="theme-item-name">{t.name}</span>
                    <span className="theme-item-mode">{t.mode}</span>
                    {t.id === currentThemeId && <span className="theme-item-check">✓</span>}
                  </button>
                ))}
              </>
            )}

            {filteredCustom.length > 0 && (
              <>
                <div className="theme-dropdown-group">Custom Themes</div>
                {filteredCustom.map(t => (
                  <button 
                    key={t.id} 
                    className={`theme-dropdown-item ${t.id === currentThemeId ? 'selected' : ''}`}
                    onClick={() => {
                      setTheme(t.id);
                      setIsOpen(false);
                    }}
                  >
                    <span className="theme-item-dot" style={{ background: t.tokens['--color-accent'] }} />
                    <span className="theme-item-name">{t.name}</span>
                    <span className="theme-item-mode">{t.mode}</span>
                    {t.id === currentThemeId && <span className="theme-item-check">✓</span>}
                  </button>
                ))}
              </>
            )}

            {filteredBuiltIn.length === 0 && filteredCustom.length === 0 && (
              <div className="theme-dropdown-empty">No themes found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
