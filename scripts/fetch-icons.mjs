// Downloads the interface icons Auralis uses from Microsoft's Fluent UI
// System Icons (MIT, https://github.com/microsoft/fluentui-system-icons)
// into src/renderer/ui/fluent-icons.json. Run with `npm run fetch-icons`.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-system-icons/main/assets'

/** Auralis icon name → Fluent icon (snake_case, 20px regular unless noted). */
const MAP = {
  back: 'arrow_left',
  forward: 'arrow_right',
  reload: 'arrow_clockwise',
  stop: 'dismiss',
  close: 'dismiss',
  home: 'home',
  plus: 'add',
  minus: 'subtract',
  'chevron-down': 'chevron_down',
  'chevron-right': 'chevron_right',
  'chevron-left': 'chevron_left',
  check: 'checkmark',
  star: 'star',
  'star-filled': 'star:filled',
  shield: 'shield',
  'shield-off': 'shield_dismiss',
  lock: 'lock_closed',
  unlock: 'lock_open',
  warning: 'warning',
  info: 'info',
  page: 'document',
  globe: 'globe',
  search: 'search',
  history: 'history',
  folder: 'folder',
  download: 'arrow_download',
  tab: 'tab',
  'tab-new': 'tab_add',
  'new-window': 'window_new',
  private: 'incognito',
  split: 'split_vertical',
  spaces: 'grid',
  layers: 'layer',
  pin: 'pin',
  mute: 'speaker_mute',
  volume: 'speaker_2',
  sleep: 'weather_moon',
  camera: 'camera',
  qr: 'qr_code',
  pip: 'picture_in_picture',
  reader: 'book_open',
  print: 'print',
  copy: 'copy',
  link: 'link',
  settings: 'settings',
  gauge: 'top_speed',
  find: 'document_search',
  save: 'save',
  code: 'code',
  wrench: 'wrench',
  'zoom-in': 'zoom_in',
  'zoom-out': 'zoom_out',
  fullscreen: 'full_screen_maximize',
  power: 'power',
  command: 'keyboard',
  trash: 'delete',
  more: 'more_horizontal',
  minimize: 'subtract',
  maximize: 'maximize',
  restore: 'square_multiple',
  pause: 'pause',
  play: 'play',
  open: 'open',
  location: 'location',
  bell: 'alert',
  mic: 'mic',
  video: 'video',
  clipboard: 'clipboard',
  cookie: 'cookies',
  certificate: 'certificate',
  edit: 'edit',
  drag: 're_order_dots_vertical',
  swap: 'arrow_swap',
  sun: 'weather_sunny',
  menu: 'navigation',
  image: 'image'
}

// Folder names are Title Case, with a few acronyms in capitals.
const ACRONYMS = { qr: 'QR' }
const title = (snake) => snake.split('_').map((w) => ACRONYMS[w] ?? w[0].toUpperCase() + w.slice(1)).join(' ')

const out = {}
const failed = []
for (const [name, spec] of Object.entries(MAP)) {
  const [icon, style = 'regular'] = spec.split(':')
  const url = `${BASE}/${encodeURIComponent(title(icon))}/SVG/ic_fluent_${icon}_20_${style}.svg`
  const res = await fetch(url)
  if (!res.ok) {
    failed.push(`${name} (${icon}): HTTP ${res.status}`)
    continue
  }
  const svg = await res.text()
  // Keep only the drawing; colour comes from currentColor at render time.
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\sfill="#[0-9a-fA-F]{3,8}"/g, '')
    .trim()
  out[name] = inner
}
fs.writeFileSync(path.join(root, 'src/renderer/ui/fluent-icons.json'), JSON.stringify(out, null, 0) + '\n')
console.log(`fluent-icons.json: ${Object.keys(out).length} icons`)
if (failed.length) {
  console.error('missing:\n  ' + failed.join('\n  '))
  process.exitCode = 1
}
