// Turns trailer stills and the teaser GIF into the images the site and README use.
// Run from trailer/ after rendering out/still-*.png and out/teaser.gif.
import sharp from 'sharp'

const site = '../site/img/'

await sharp('out/still-title.png').resize(1600, 640, { fit: 'cover', position: 'centre' }).jpeg({ quality: 86, mozjpeg: true }).toFile(site + 'banner.jpg')
await sharp('out/still-title.png').resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 86, mozjpeg: true }).toFile(site + 'social.jpg')
await sharp('out/still-poster.png').resize(1280, 720).jpeg({ quality: 84, mozjpeg: true }).toFile(site + 'trailer-poster.jpg')
await sharp('out/teaser.gif', { animated: true }).webp({ quality: 70, effort: 6 }).toFile(site + 'teaser.webp')
console.log('done')
