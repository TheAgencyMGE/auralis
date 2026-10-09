// Minimal .ico decoder for favicons. nativeImage.createFromBuffer handles
// PNG and JPEG but not ICO, which many sites (Wikipedia among them) still
// serve. Picks the entry closest to the wanted size and returns either the
// embedded PNG or a BGRA bitmap.

export type DecodedIcon = { kind: 'png'; data: Buffer } | { kind: 'bgra'; width: number; height: number; data: Buffer }

interface Entry {
  width: number
  height: number
  bpp: number
  size: number
  offset: number
}

export function isIco(buf: Buffer): boolean {
  return buf.length > 6 && buf.readUInt16LE(0) === 0 && (buf.readUInt16LE(2) === 1 || buf.readUInt16LE(2) === 2)
}

export function decodeIco(buf: Buffer, want = 32): DecodedIcon | null {
  if (!isIco(buf)) return null
  const count = buf.readUInt16LE(4)
  if (count === 0 || count > 64 || 6 + count * 16 > buf.length) return null
  const entries: Entry[] = []
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16
    const e: Entry = {
      width: buf[o] || 256,
      height: buf[o + 1] || 256,
      bpp: buf.readUInt16LE(o + 6),
      size: buf.readUInt32LE(o + 8),
      offset: buf.readUInt32LE(o + 12)
    }
    if (e.offset + e.size <= buf.length && e.size > 0) entries.push(e)
  }
  if (!entries.length) return null
  // Prefer the smallest entry at least `want` wide; then more colour depth.
  entries.sort((a, b) => {
    const da = a.width >= want ? a.width - want : 1000 + want - a.width
    const db = b.width >= want ? b.width - want : 1000 + want - b.width
    return da - db || (b.bpp || 32) - (a.bpp || 32)
  })
  for (const e of entries) {
    const data = buf.subarray(e.offset, e.offset + e.size)
    if (data.length >= 8 && data.readUInt32BE(0) === 0x89504e47) return { kind: 'png', data: Buffer.from(data) }
    const bmp = decodeDib(data)
    if (bmp) return bmp
  }
  return null
}

function decodeDib(d: Buffer): DecodedIcon | null {
  if (d.length < 40 || d.readUInt32LE(0) < 40) return null
  const headerSize = d.readUInt32LE(0)
  const width = d.readInt32LE(4)
  const height = Math.abs(d.readInt32LE(8)) / 2 // XOR + AND masks
  const bpp = d.readUInt16LE(14)
  const compression = d.readUInt32LE(16)
  if (width <= 0 || height <= 0 || width > 512 || height > 512 || compression !== 0) return null
  if (![1, 4, 8, 24, 32].includes(bpp)) return null
  const paletteSize = bpp <= 8 ? (d.readUInt32LE(32) || 1 << bpp) : 0
  const paletteOffset = headerSize
  const xorOffset = paletteOffset + paletteSize * 4
  const xorStride = Math.floor((width * bpp + 31) / 32) * 4
  const andOffset = xorOffset + xorStride * height
  const andStride = Math.floor((width + 31) / 32) * 4
  if (xorOffset + xorStride * height > d.length) return null
  const hasAnd = andOffset + andStride * height <= d.length
  const out = Buffer.alloc(width * height * 4)
  let anyAlpha = false
  for (let y = 0; y < height; y++) {
    const src = xorOffset + (height - 1 - y) * xorStride // rows are stored bottom-up
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      let b = 0
      let g = 0
      let r = 0
      let a = 255
      if (bpp === 32) {
        b = d[src + x * 4]
        g = d[src + x * 4 + 1]
        r = d[src + x * 4 + 2]
        a = d[src + x * 4 + 3]
        if (a) anyAlpha = true
      } else if (bpp === 24) {
        b = d[src + x * 3]
        g = d[src + x * 3 + 1]
        r = d[src + x * 3 + 2]
      } else {
        const bitPos = x * bpp
        const byte = d[src + (bitPos >> 3)]
        const shift = 8 - bpp - (bitPos & 7)
        const idx = (byte >> shift) & ((1 << bpp) - 1)
        const p = paletteOffset + idx * 4
        b = d[p]
        g = d[p + 1]
        r = d[p + 2]
      }
      out[o] = b
      out[o + 1] = g
      out[o + 2] = r
      out[o + 3] = a
    }
  }
  // Without real alpha (or below 32bpp) the AND mask carries transparency.
  if ((bpp < 32 || !anyAlpha) && hasAnd) {
    for (let y = 0; y < height; y++) {
      const src = andOffset + (height - 1 - y) * andStride
      for (let x = 0; x < width; x++) {
        const masked = (d[src + (x >> 3)] >> (7 - (x & 7))) & 1
        out[(y * width + x) * 4 + 3] = masked ? 0 : 255
      }
    }
  }
  return { kind: 'bgra', width, height, data: out }
}
