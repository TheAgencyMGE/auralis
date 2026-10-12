// Turns screenshots, trailer stills and the teaser GIF into the images the site and README use.
// Run from trailer/ after rendering out/still-*.png and out/teaser.gif.
import sharp from 'sharp'

const site = '../site/img/'

// Screenshots, from public/shots (made by capture.mjs).
const shots = {
  'aqua-home': 'ntp-fields', 'aqua-gadgets': 'sidebar-wiki', 'aqua-menu': 'appmenu', 'aqua-compact': 'compact',
  flip3d: 'flip3d-1', tabflip: 'tabflip', 'live-dolphins': 'ntp-dolphins', 'live-bubbles': 'ntp-bubbles',
  welcome: 'welcome', unsafe: 'unsafe', splash: 'splash', 'modern-home': 'modern-ntp-fields',
  'modern-gadgets': 'modern-sidebar-wiki', 'modern-flip3d': 'modern-flip3d-1', 'modern-menu': 'modern-appmenu'
}
for (const [name, src] of Object.entries(shots)) await sharp(`public/shots/${src}.png`).webp({ quality: 86 }).toFile(`${site}${name}.webp`)

await sharp('out/still-title.png').resize(1600, 640, { fit: 'cover', position: 'centre' }).jpeg({ quality: 86, mozjpeg: true }).toFile(site + 'banner.jpg')
await sharp('out/still-title.png').resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 86, mozjpeg: true }).toFile(site + 'social.jpg')
await sharp('out/still-poster.png').resize(1280, 720).jpeg({ quality: 84, mozjpeg: true }).toFile(site + 'trailer-poster.jpg')
await sharp('out/teaser.gif', { animated: true }).webp({ quality: 70, effort: 6 }).toFile(site + 'teaser.webp')
console.log('done')
