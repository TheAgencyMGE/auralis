// Downloads the illustrated icons Auralis uses (weather, page headers,
// Welcome Center tiles...) from KDE's Oxygen icon theme, the glossy set of
// 2008 (LGPL-3.0-or-later, https://github.com/KDE/oxygen-icons), into
// src/renderer/public/art/icons/<name>.webp. Run with `npm run fetch-assets`.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'src/renderer/public/art/icons')
const BASE = 'https://raw.githubusercontent.com/KDE/oxygen-icons/master/'

/** Auralis name → Oxygen icon (context/name, without size folder). */
const ICONS = {
  // weather
  sun: 'status/weather-clear',
  moon: 'status/weather-clear-night',
  'sun-small-cloud': 'status/weather-few-clouds',
  'sun-cloud': 'status/weather-clouds',
  cloud: 'status/weather-many-clouds',
  rain: 'status/weather-showers',
  'sun-rain': 'status/weather-showers-scattered-day',
  snow: 'status/weather-snow',
  storm: 'status/weather-storm',
  fog: 'status/weather-mist',
  // pages and tiles
  settings: 'categories/preferences-system',
  favorites: 'places/bookmarks',
  history: 'apps/clock',
  downloads: 'places/folder-downloads',
  tasks: 'apps/utilities-system-monitor',
  info: 'status/dialog-information',
  folder: 'places/folder',
  warning: 'status/dialog-warning',
  shield: 'status/security-high',
  unsafe: 'status/security-low',
  private: 'actions/system-lock-screen',
  wallpaper: 'apps/preferences-desktop-wallpaper',
  search: 'actions/system-search',
  color: 'apps/preferences-desktop-color',
  sound: 'apps/preferences-desktop-sound',
  browser: 'apps/internet-web-browser',
  web: 'categories/applications-internet',
  extensions: 'apps/preferences-plugin',
  notes: 'apps/knotes'
}

/** Fetch a file from the repo, following its symlinks. */
async function get(file) {
  let p = file
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(BASE + p)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf[0] === 0x89) return buf
    p = new URL(buf.toString().trim(), 'http://x/' + p).pathname.slice(1)
  }
  return null
}

fs.mkdirSync(out, { recursive: true })
const failed = []
for (const [name, icon] of Object.entries(ICONS)) {
  let buf = null
  for (const size of ['256x256', '128x128']) if ((buf = await get(`${size}/${icon}.png`))) break
  if (!buf) {
    failed.push(name)
    continue
  }
  await sharp(buf).resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toFile(path.join(out, `${name}.webp`))
}
// 16 px web fallback for sites without a favicon.
const small = await get('16x16/categories/applications-internet.png')
if (small) fs.writeFileSync(path.join(out, 'web-16.png'), small)
const small32 = await get('32x32/categories/applications-internet.png')
if (small32) fs.writeFileSync(path.join(out, 'web-32.png'), small32)

console.log(`art: ${Object.keys(ICONS).length - failed.length} icons`)
if (failed.length) {
  console.error('missing: ' + failed.join(', '))
  process.exitCode = 1
}
