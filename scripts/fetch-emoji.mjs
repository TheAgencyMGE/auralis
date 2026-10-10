// Downloads 3D artwork from Microsoft's Fluent Emoji (MIT,
// https://github.com/microsoft/fluentui-emoji) into src/renderer/public/emoji
// and renders the application icon from the globe. Run: npm run fetch-emoji
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'src/renderer/public/emoji')
const BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets'
fs.mkdirSync(out, { recursive: true })

/** file name → Fluent Emoji folder name */
const EMOJI = {
  globe: 'Globe showing americas',
  folder: 'File folder',
  sun: 'Sun',
  'sun-small-cloud': 'Sun behind small cloud',
  'sun-cloud': 'Sun behind cloud',
  'sun-rain': 'Sun behind rain cloud',
  cloud: 'Cloud',
  rain: 'Cloud with rain',
  snow: 'Cloud with snow',
  storm: 'Cloud with lightning and rain',
  fog: 'Fog',
  moon: 'Crescent moon',
  gear: 'Gear',
  star: 'Star',
  clock: 'Mantelpiece clock',
  inbox: 'Inbox tray',
  chart: 'Bar chart',
  info: 'Information',
  memo: 'Memo',
  shield: 'Shield',
  warning: 'Warning',
  detective: 'Detective',
  palette: 'Artist palette',
  picture: 'Framed picture',
  magnifier: 'Magnifying glass tilted left',
  bell: 'Bell',
  puzzle: 'Puzzle piece'
}

const failed = []
for (const [file, folder] of Object.entries(EMOJI)) {
  const name = folder.toLowerCase().replace(/ /g, '_')
  // Some emoji have skin-tone variants; their 3D art lives under Default/.
  const urls = [`${BASE}/${encodeURIComponent(folder)}/3D/${name}_3d.png`, `${BASE}/${encodeURIComponent(folder)}/Default/3D/${name}_3d_default.png`]
  let buf = null
  for (const url of urls) {
    const res = await fetch(url)
    if (res.ok) {
      buf = Buffer.from(await res.arrayBuffer())
      break
    }
  }
  if (!buf) {
    failed.push(`${file} (${folder})`)
    continue
  }
  await sharp(buf).resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toFile(path.join(out, `${file}.webp`))
  if (file === 'globe') {
    // The application icon: Fluent's 3D globe at every Windows size.
    const icon = path.join(root, 'build')
    fs.mkdirSync(icon, { recursive: true })
    const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
    const pngs = await Promise.all(sizes.map((s) => sharp(buf).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()))
    fs.writeFileSync(path.join(icon, 'icon.ico'), await pngToIco(pngs))
    fs.writeFileSync(path.join(icon, 'icon.png'), pngs[pngs.length - 1])
  }
}
console.log(`emoji: ${Object.keys(EMOJI).length - failed.length} downloaded`)
if (failed.length) {
  console.error('missing: ' + failed.join(', '))
  process.exitCode = 1
}
