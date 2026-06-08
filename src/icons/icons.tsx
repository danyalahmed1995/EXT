import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// ── UI Icons ─────────────────────────────────────────────

export const SearchIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
    <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <polyline points="6,3 11,8 6,13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <polyline points="3,6 8,11 13,6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
    <polyline points="8,5 8,8 10.5,9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const StarIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M8 2l1.8 3.6L14 6.2l-3 2.9.7 4.1L8 11.3 4.3 13.2l.7-4.1-3-2.9 4.2-.6L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

export const StarFilledIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style}>
    <path d="M8 2l1.8 3.6L14 6.2l-3 2.9.7 4.1L8 11.3 4.3 13.2l.7-4.1-3-2.9 4.2-.6L8 2z" />
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <line x1="2" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.5" />
    <line x1="5.5" y1="1.5" x2="5.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="10.5" y1="1.5" x2="10.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const ChecklistIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <polyline points="2,4.5 3.5,6 6,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="8.5" y1="4.5" x2="14" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polyline points="2,9 3.5,10.5 6,7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="8.5" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="2" y="12" width="4" height="1.5" rx="0.5" stroke="currentColor" strokeWidth="1" />
    <line x1="8.5" y1="12.75" x2="14" y2="12.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const FolderIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M2 4a1 1 0 011-1h3.5l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const SparkleIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M8 1l1.2 3.8L13 6l-3.8 1.2L8 11l-1.2-3.8L3 6l3.8-1.2L8 1z" fill="currentColor" />
    <path d="M12 9l.6 1.9L14.5 11.5l-1.9.6L12 14l-.6-1.9-1.9-.6 1.9-.6L12 9z" fill="currentColor" opacity="0.6" />
  </svg>
);

export const EditorIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="5" y1="8" x2="9" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="5" y1="10.5" x2="10" y2="10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export const SplitIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const PreviewIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5 5.5h6M5 8h3M5 10.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    <circle cx="10.5" cy="10" r="1.5" fill="currentColor" opacity="0.7" />
  </svg>
);

export const HashIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <line x1="5.5" y1="2" x2="4" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="2" x2="10.5" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="2" y1="10.5" x2="14" y2="10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const NewFileIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M4 2h5l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
    <polyline points="9,2 9,5 12,5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <line x1="8" y1="8" x2="8" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <line x1="6" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

// ── File Type Icons ──────────────────────────────────────

export const FileMarkdownIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="2" y="1.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4.5 10.5V5.5l2 2.5 2-2.5v5M10 8.5l1.5-2 1.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const FileTextIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="2" y="1.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="7.5" x2="11" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="10" x2="9" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// ── Tech / Project Icons ─────────────────────────────────

export const TypeScriptIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#3178c6" />
    <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">TS</text>
  </svg>
);

export const PythonIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#3572a5" />
    <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">Py</text>
  </svg>
);

export const RustIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#dea584" />
    <text x="8" y="11.5" textAnchor="middle" fill="#1a1a1a" fontSize="8" fontWeight="bold" fontFamily="sans-serif">Rs</text>
  </svg>
);

export const GoIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#00add8" />
    <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="sans-serif">Go</text>
  </svg>
);

export const DockerIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#2496ed" />
    <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">🐳</text>
  </svg>
);

export const PromptIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#9b59b6" />
    <path d="M5 8h4M5 10.5l2-2.5L5 5.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const BugIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#e74c3c" />
    <circle cx="8" cy="8.5" r="3" stroke="white" strokeWidth="1.3" />
    <line x1="8" y1="5.5" x2="8" y2="11.5" stroke="white" strokeWidth="1" />
    <line x1="5" y1="8.5" x2="11" y2="8.5" stroke="white" strokeWidth="1" />
  </svg>
);

export const MarkdownIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#6c6c8a" />
    <path d="M4 10.5V5.5l2 2.5 2-2.5v5M10 8.5l1.5-2 1.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const DocumentIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#5b7a9d" />
    <line x1="5" y1="5" x2="11" y2="5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="7.5" x2="11" y2="7.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="10" x2="9" y2="10" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const NoteIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#f39c12" />
    <line x1="5" y1="5" x2="11" y2="5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="7.5" x2="10" y2="7.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="10" x2="8" y2="10" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const UnityIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#222c37" />
    <text x="8" y="11" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">U</text>
  </svg>
);

export const JavaScriptIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#f7df1e" />
    <text x="8" y="11.5" textAnchor="middle" fill="#1a1a1a" fontSize="8" fontWeight="bold" fontFamily="sans-serif">JS</text>
  </svg>
);

export const GitHubIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style}>
    <path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

// ── Save Icon ────────────────────────────────────────────

export const SaveIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M3 2h8l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
    <rect x="5" y="9" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="5.5" y="2" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1" />
  </svg>
);

// ── Unsaved dot indicator ────────────────────────────────

export const UnsavedDot: React.FC<IconProps> = ({ size = 8, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 8 8" className={className} style={style}>
    <circle cx="4" cy="4" r="3.5" fill="currentColor" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} style={style}>
    <path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M4 4v9a2 2 0 002 2h4a2 2 0 002-2V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6.5" y1="7" x2="6.5" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="9.5" y1="7" x2="9.5" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const EXTIcon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <img src="/icon.png" width={size} height={size} className={className} style={{...style, objectFit: 'contain'}} alt="EXT" />
);
