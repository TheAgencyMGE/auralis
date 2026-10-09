/** Vista's manila folder, shared by the bar and folder menus. */
export function FolderGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="folder-glyph">
      <defs>
        <linearGradient id="fold-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7d774" />
          <stop offset="1" stopColor="#d9a32a" />
        </linearGradient>
        <linearGradient id="fold-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffeaa1" />
          <stop offset="1" stopColor="#f0bd3e" />
        </linearGradient>
      </defs>
      <path d="M1.5 3.5a1 1 0 0 1 1-1h3.6l1.4 1.5h6a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" fill="url(#fold-back)" stroke="#b07f17" strokeWidth=".7" />
      <path d="M1.5 6.2h13V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" fill="url(#fold-front)" stroke="#c08d1d" strokeWidth=".7" />
      <path d="M2.2 6.9h11.6" stroke="rgba(255,255,255,.75)" strokeWidth=".8" />
    </svg>
  )
}
