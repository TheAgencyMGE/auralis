// Auralis glyphs: one hand, one grid (16px, 1.5px strokes, round joins).
// Colour comes from currentColor so context decides tone.
import type { CSSProperties, ReactElement } from 'react'

const P = (d: string) => <path d={d} />

const GLYPHS: Record<string, ReactElement> = {
  back: P('M9.5 3.5 5 8l4.5 4.5M5.5 8H13'),
  forward: P('M6.5 3.5 11 8l-4.5 4.5M10.5 8H3'),
  reload: (
    <>
      {P('M13 8a5 5 0 1 1-1.6-3.7')}
      {P('M13 2.8v3h-3')}
    </>
  ),
  stop: P('M4 4l8 8M12 4l-8 8'),
  close: P('M4.5 4.5l7 7M11.5 4.5l-7 7'),
  home: P('M2.5 7.5 8 3l5.5 4.5M4 6.5V13h3v-3.2h2V13h3V6.5'),
  plus: P('M8 3v10M3 8h10'),
  minus: P('M3 8h10'),
  'chevron-down': P('M4 6l4 4 4-4'),
  'chevron-right': P('M6 4l4 4-4 4'),
  'chevron-left': P('M10 4 6 8l4 4'),
  check: P('M3.5 8.5 6.5 11.5 12.5 4.5'),
  star: P('M8 2.3l1.75 3.6 3.95.55-2.86 2.78.68 3.92L8 11.3l-3.52 1.85.68-3.92L2.3 6.45l3.95-.55z'),
  shield: P('M8 2 3 3.8v3.9c0 3 2.1 5.3 5 6.3 2.9-1 5-3.3 5-6.3V3.8z'),
  'shield-off': (
    <>
      {P('M8 2 3 3.8v3.9c0 3 2.1 5.3 5 6.3 2.9-1 5-3.3 5-6.3V3.8z')}
      {P('M3 13 13 3')}
    </>
  ),
  lock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.3" />
      {P('M5.5 7V5.3a2.5 2.5 0 0 1 5 0V7')}
    </>
  ),
  unlock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.3" />
      {P('M5.5 7V5.3a2.5 2.5 0 0 1 4.8-1')}
    </>
  ),
  warning: (
    <>
      {P('M8 2.5 14 13H2z')}
      {P('M8 6.5v3M8 11.2v.1')}
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      {P('M8 7.3v3.7M8 5.1v.1')}
    </>
  ),
  page: (
    <>
      {P('M4 2.5h5l3 3v8H4z')}
      {P('M9 2.5v3h3')}
    </>
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      {P('M2.5 8h11M8 2.25c1.7 1.6 2.4 3.6 2.4 5.75S9.7 12.15 8 13.75M8 2.25C6.3 3.85 5.6 5.85 5.6 8s.7 4.15 2.4 5.75')}
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.25" />
      {P('M10.2 10.2 13.5 13.5')}
    </>
  ),
  history: (
    <>
      {P('M2.6 8a5.4 5.4 0 1 0 1.6-3.8')}
      {P('M2.5 2.8v2.6h2.6M8 5.2V8l2 1.4')}
    </>
  ),
  folder: P('M2 4.5V12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7.6L6.1 3.5H3A1 1 0 0 0 2 4.5z'),
  download: P('M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 13h10'),
  tab: (
    <>
      <rect x="2" y="4" width="12" height="9" rx="1.2" />
      {P('M2 6.5h6V4')}
    </>
  ),
  'tab-new': (
    <>
      <rect x="2" y="4" width="12" height="9" rx="1.2" />
      {P('M8 6.6v4.2M5.9 8.7h4.2')}
    </>
  ),
  'new-window': (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.2" />
      {P('M2.5 5.5h11')}
    </>
  ),
  private: (
    <>
      {P('M2.5 7.2c1.6-.9 3.4-1.3 5.5-1.3s3.9.4 5.5 1.3')}
      {P('M4 6l.9-2.5h6.2L12 6')}
      <circle cx="5.3" cy="10.4" r="1.7" />
      <circle cx="10.7" cy="10.4" r="1.7" />
      {P('M7 10.4h2')}
    </>
  ),
  split: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.2" />
      {P('M8 3v10')}
    </>
  ),
  spaces: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  layers: (
    <>
      {P('M8 2.5 14 5.6 8 8.7 2 5.6z')}
      {P('M2 8.4l6 3.1 6-3.1M2 11.2 8 14.3l6-3.1')}
    </>
  ),
  pin: P('M9.6 2.5 13.5 6.4l-2.2.7-2.4 2.4.1 2.6-1 1L6 11.1 2.8 14.3 6 11.1 3 8.1l1-1 2.6.1L9 4.8z'),
  mute: (
    <>
      {P('M2.5 6h2.3L8 3.3v9.4L4.8 10H2.5z')}
      {P('M10.5 6.2 13.5 9.8M13.5 6.2l-3 3.6')}
    </>
  ),
  volume: (
    <>
      {P('M2.5 6h2.3L8 3.3v9.4L4.8 10H2.5z')}
      {P('M10.4 5.7a3.2 3.2 0 0 1 0 4.6M12.2 4a5.6 5.6 0 0 1 0 8')}
    </>
  ),
  sleep: P('M10.8 3.2a5.2 5.2 0 1 0 2 6.6 4.4 4.4 0 0 1-2-6.6z'),
  camera: (
    <>
      {P('M2 5.5A1.2 1.2 0 0 1 3.2 4.3h1.6l1-1.6h4.4l1 1.6h1.6A1.2 1.2 0 0 1 14 5.5v6.3A1.2 1.2 0 0 1 12.8 13H3.2A1.2 1.2 0 0 1 2 11.8z')}
      <circle cx="8" cy="8.5" r="2.4" />
    </>
  ),
  qr: (
    <>
      <rect x="2.5" y="2.5" width="4" height="4" rx=".6" />
      <rect x="9.5" y="2.5" width="4" height="4" rx=".6" />
      <rect x="2.5" y="9.5" width="4" height="4" rx=".6" />
      {P('M9.5 9.5h1.5v1.5M13.5 9.5v.1M12 12v1.5h1.5M9.5 13.5v.1')}
    </>
  ),
  pip: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.2" />
      <rect x="8" y="8" width="4.5" height="3.5" rx=".6" />
    </>
  ),
  reader: (
    <>
      {P('M8 4.2C6.6 3.2 4.6 2.9 2.5 3.2v9.3c2.1-.3 4.1 0 5.5 1 1.4-1 3.4-1.3 5.5-1V3.2c-2.1-.3-4.1 0-5.5 1z')}
      {P('M8 4.2v9.3')}
    </>
  ),
  print: (
    <>
      {P('M4.5 6V2.5h7V6')}
      <rect x="2" y="6" width="12" height="5.5" rx="1.2" />
      {P('M4.5 9.5h7v4h-7z')}
    </>
  ),
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
      {P('M10.5 5.5V3.7a1.2 1.2 0 0 0-1.2-1.2H3.7a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 1.2 1.2h1.8')}
    </>
  ),
  link: P('M6.8 9.2l2.4-2.4M7.6 4.6l1-1a2.5 2.5 0 0 1 3.6 3.6l-1 1M8.4 11.4l-1 1a2.5 2.5 0 0 1-3.6-3.6l1-1'),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.1" />
      {P('M8 1.8v1.7M8 12.5v1.7M14.2 8h-1.7M3.5 8H1.8M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2M12.4 12.4l-1.2-1.2M4.8 4.8 3.6 3.6')}
    </>
  ),
  gauge: (
    <>
      {P('M2.8 11.5a5.6 5.6 0 1 1 10.4 0')}
      {P('M8 9.2 10.6 5.6')}
      <circle cx="8" cy="9.6" r=".9" />
    </>
  ),
  find: (
    <>
      {P('M4 2.5h5l3 3v2.2M12 13.5H4v-11')}
      <circle cx="10" cy="10.5" r="2" />
      {P('M11.5 12l1.8 1.8')}
    </>
  ),
  save: (
    <>
      {P('M2.5 3.7a1.2 1.2 0 0 1 1.2-1.2h7.1l2.7 2.7v7.1a1.2 1.2 0 0 1-1.2 1.2H3.7a1.2 1.2 0 0 1-1.2-1.2z')}
      {P('M5 2.5v3.2h5V2.5M5 13.5V9.5h6v4')}
    </>
  ),
  code: P('M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5'),
  wrench: P('M13.3 4.4a3.2 3.2 0 0 1-4.3 3.9L4.4 12.9a1.2 1.2 0 0 1-1.7-1.7L7.3 6.6a3.2 3.2 0 0 1 3.9-4.3L9.4 4.1l.6 1.9 1.9.6z'),
  'zoom-in': (
    <>
      <circle cx="7" cy="7" r="4.25" />
      {P('M10.2 10.2 13.5 13.5M7 5v4M5 7h4')}
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="7" cy="7" r="4.25" />
      {P('M10.2 10.2 13.5 13.5M5 7h4')}
    </>
  ),
  fullscreen: P('M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10'),
  power: (
    <>
      {P('M8 2.3v5')}
      {P('M4.6 4.2a5 5 0 1 0 6.8 0')}
    </>
  ),
  command: P('M5.5 2.5a1.5 1.5 0 1 0 0 3h5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0-1.5 1.5v8a1.5 1.5 0 1 0 1.5-1.5h-5A1.5 1.5 0 1 0 7 12V4a1.5 1.5 0 0 0-1.5-1.5z'),
  trash: (
    <>
      {P('M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.3a.8.8 0 0 0 .8.7h5a.8.8 0 0 0 .8-.7l.7-8.3')}
      {P('M6.7 7v4.2M9.3 7v4.2')}
    </>
  ),
  more: (
    <>
      <circle cx="3.5" cy="8" r=".6" />
      <circle cx="8" cy="8" r=".6" />
      <circle cx="12.5" cy="8" r=".6" />
    </>
  ),
  minimize: P('M3.5 8.5h9'),
  maximize: <rect x="3.5" y="3.5" width="9" height="9" rx=".5" />,
  restore: (
    <>
      <rect x="3" y="5.5" width="7.5" height="7.5" rx=".5" />
      {P('M5.5 5.5V3h7.5v7.5H10.5')}
    </>
  ),
  pause: P('M5.5 3.5v9M10.5 3.5v9'),
  play: P('M5 3.2v9.6L12.5 8z'),
  open: P('M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3'),
  location: (
    <>
      {P('M8 14s-4.5-4.4-4.5-7.6a4.5 4.5 0 0 1 9 0C12.5 9.6 8 14 8 14z')}
      <circle cx="8" cy="6.4" r="1.6" />
    </>
  ),
  bell: (
    <>
      {P('M4 11V7.3a4 4 0 0 1 8 0V11l1.2 1.4H2.8z')}
      {P('M6.6 13.6a1.5 1.5 0 0 0 2.8 0')}
    </>
  ),
  mic: (
    <>
      <rect x="6" y="2" width="4" height="7.5" rx="2" />
      {P('M3.8 7.6a4.2 4.2 0 0 0 8.4 0M8 11.8v2.2')}
    </>
  ),
  video: (
    <>
      <rect x="2" y="4.2" width="8.5" height="7.6" rx="1.2" />
      {P('M10.5 7 14 5v6l-3.5-2')}
    </>
  ),
  clipboard: (
    <>
      <rect x="3.5" y="3" width="9" height="11" rx="1.2" />
      {P('M6 3V2h4v1')}
    </>
  ),
  cookie: (
    <>
      {P('M13.4 8.6A5.5 5.5 0 1 1 7.4 2.6a2 2 0 0 0 2.5 2.4 2 2 0 0 0 3.5 3.6z')}
      <circle cx="5.8" cy="7" r=".5" />
      <circle cx="8.5" cy="10.5" r=".5" />
      <circle cx="5.6" cy="10.3" r=".5" />
    </>
  ),
  certificate: (
    <>
      <rect x="2" y="3" width="12" height="8" rx="1" />
      {P('M4.5 5.8h4M4.5 8h2.5')}
      <circle cx="11" cy="9.5" r="1.6" />
      {P('M10.2 10.9 9.8 13.5l1.2-.7 1.2.7-.4-2.6')}
    </>
  ),
  edit: P('M10.3 3.2l2.5 2.5-7.3 7.3-3 .5.5-3z'),
  drag: (
    <>
      <circle cx="6" cy="4" r=".6" />
      <circle cx="10" cy="4" r=".6" />
      <circle cx="6" cy="8" r=".6" />
      <circle cx="10" cy="8" r=".6" />
      <circle cx="6" cy="12" r=".6" />
      <circle cx="10" cy="12" r=".6" />
    </>
  ),
  swap: P('M3 5.5h9.5L10 3M13 10.5H3.5L6 13'),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.8" />
      {P('M8 1.8v1.4M8 12.8v1.4M14.2 8h-1.4M3.2 8H1.8M12.4 3.6l-1 1M4.6 11.4l-1 1M12.4 12.4l-1-1M4.6 4.6l-1-1')}
    </>
  ),
  menu: P('M2.5 4.5h11M2.5 8h11M2.5 11.5h11')
}

export type IconName = keyof typeof GLYPHS

/** Command ids → glyphs, so menus and the palette share one vocabulary. */
export const COMMAND_ICONS: Record<string, string> = {
  'new-tab': 'tab-new',
  'new-window': 'new-window',
  'new-private': 'private',
  'reopen-tab': 'history',
  'close-tab': 'close',
  'close-window': 'close',
  find: 'find',
  print: 'print',
  'save-page': 'save',
  screenshot: 'camera',
  'screenshot-full': 'camera',
  reader: 'reader',
  'split-view': 'split',
  'tab-flip': 'layers',
  favorites: 'star',
  bookmark: 'star',
  history: 'history',
  downloads: 'download',
  'task-manager': 'gauge',
  settings: 'settings',
  about: 'info',
  qr: 'qr',
  pip: 'pip',
  devtools: 'wrench',
  'view-source': 'code',
  'zoom-in': 'zoom-in',
  'zoom-out': 'zoom-out',
  'zoom-reset': 'search',
  fullscreen: 'fullscreen',
  quit: 'power',
  palette: 'command',
  'clear-data': 'trash',
  'focus-address': 'search',
  back: 'back',
  forward: 'forward',
  reload: 'reload',
  'hard-reload': 'reload',
  home: 'home',
  'mute-tab': 'mute',
  'pin-tab': 'pin',
  'duplicate-tab': 'copy',
  'sleep-tab': 'sleep',
  'new-space': 'spaces',
  'next-space': 'spaces',
  'prev-space': 'spaces',
  'next-tab': 'tab',
  'prev-tab': 'tab',
  'toggle-bar': 'star',
  'toggle-status': 'page'
}

export function Icon({ name, size = 16, className, style, title }: { name: string; size?: number; className?: string; style?: CSSProperties; title?: string }) {
  const glyph = GLYPHS[name] ?? GLYPHS[COMMAND_ICONS[name] ?? ''] ?? GLYPHS.page
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {glyph}
    </svg>
  )
}

/** Site icon: the page's favicon, or a small blue glass globe. */
export function Favicon({ src, size = 16, dim = false }: { src: string | null | undefined; size?: number; dim?: boolean }) {
  if (src && src !== 'page') {
    return <img className={`favicon${dim ? ' is-dim' : ''}`} src={src} width={size} height={size} alt="" draggable={false} />
  }
  return (
    <svg className={`favicon favicon-globe${dim ? ' is-dim' : ''}`} width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <defs>
        <radialGradient id="fg-body" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#bfe8ff" />
          <stop offset=".55" stopColor="#3d9be0" />
          <stop offset="1" stopColor="#1a5aa3" />
        </radialGradient>
      </defs>
      <circle cx="8" cy="8" r="6.6" fill="url(#fg-body)" stroke="#1c5590" strokeWidth=".8" />
      <path d="M2 8h12M8 1.6c1.6 1.7 2.3 3.9 2.3 6.4S9.6 12.7 8 14.4M8 1.6C6.4 3.3 5.7 5.5 5.7 8s.7 4.7 2.3 6.4" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".8" />
      <ellipse cx="7" cy="4.6" rx="3.6" ry="2" fill="rgba(255,255,255,.55)" />
    </svg>
  )
}
