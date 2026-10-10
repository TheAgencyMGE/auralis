// Interface icons: Microsoft's Fluent UI System Icons (MIT), fetched by
// scripts/fetch-icons.mjs into fluent-icons.json. Nothing here is hand-drawn.
// Colour comes from currentColor so context decides tone.
import type { CSSProperties } from 'react'
import GLYPHS from './fluent-icons.json'

const glyphs = GLYPHS as Record<string, string>

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
  'flip-3d': 'flip',
  'toggle-sidebar': 'sidebar',
  welcome: 'globe',
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
  const glyph = glyphs[name] ?? glyphs[COMMAND_ICONS[name] ?? ''] ?? glyphs.page
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title.replace(/[<&>]/g, '')}</title>` : '') + glyph }}
    />
  )
}

/** Site icon: the page's favicon, or Fluent's 3D globe. */
export function Favicon({ src, size = 16, dim = false }: { src: string | null | undefined; size?: number; dim?: boolean }) {
  const url = src && src !== 'page' ? src : '/emoji/globe.webp'
  return <img className={`favicon${dim ? ' is-dim' : ''}`} src={url} width={size} height={size} alt="" draggable={false} />
}
