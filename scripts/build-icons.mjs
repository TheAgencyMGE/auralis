// Renders the Auralis orb (src/renderer/ui/orb.svg) to the Windows icon set.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = path.resolve(import.meta.dirname, '..')
const svg = fs.readFileSync(path.join(root, 'src/renderer/ui/orb.svg'))
const out = path.join(root, 'build')
fs.mkdirSync(out, { recursive: true })

const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const pngs = []
for (const size of sizes) {
  // Render large then downsample: small sizes stay crisp and keep the gloss.
  const buf = await sharp(svg, { density: 72 * (1024 / 64) }).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer()
  pngs.push(buf)
  if (size === 256) fs.writeFileSync(path.join(out, 'icon.png'), buf)
}
fs.writeFileSync(path.join(out, 'icon.ico'), await pngToIco(pngs))
const big = await sharp(svg, { density: 72 * (1024 / 64) }).resize(512, 512).png().toBuffer()
fs.writeFileSync(path.join(out, 'icon-512.png'), big)
console.log('icons written to', out)
