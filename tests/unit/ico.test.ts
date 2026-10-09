import { describe, expect, it } from 'vitest'
import { decodeIco, isIco } from '../../src/main/ico'

/** Build a one-entry .ico holding a 2×2 32bpp DIB. */
function makeIco(pixels: number[][], andMask?: number[]): Buffer {
  const w = 2
  const h = 2
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(w, 4)
  header.writeInt32LE(h * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  const xor = Buffer.alloc(w * h * 4)
  // Stored bottom-up: row 1 first.
  ;[pixels.slice(2, 4), pixels.slice(0, 2)].flat().forEach((p, i) => xor.set(p, i * 4))
  const and = Buffer.alloc(4 * h)
  if (andMask) andMask.forEach((v, i) => (and[i * 4] = v))
  const dib = Buffer.concat([header, xor, and])
  const dir = Buffer.alloc(6 + 16)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(1, 4)
  dir[6] = w
  dir[7] = h
  dir.writeUInt16LE(32, 12)
  dir.writeUInt32LE(dib.length, 14)
  dir.writeUInt32LE(22, 18)
  return Buffer.concat([dir, dib])
}

describe('ico decoder', () => {
  it('decodes a 32bpp DIB entry top-down in BGRA', () => {
    const red = [0, 0, 255, 255]
    const green = [0, 255, 0, 255]
    const blue = [255, 0, 0, 255]
    const clear = [0, 0, 0, 0]
    const ico = makeIco([red, green, blue, clear])
    expect(isIco(ico)).toBe(true)
    const out = decodeIco(ico)!
    expect(out.kind).toBe('bgra')
    if (out.kind !== 'bgra') return
    expect([out.width, out.height]).toEqual([2, 2])
    expect([...out.data.subarray(0, 4)]).toEqual(red)
    expect([...out.data.subarray(8, 12)]).toEqual(blue)
    expect(out.data[15]).toBe(0)
  })
  it('uses the AND mask when there is no alpha channel', () => {
    const opaqueBlack = [0, 0, 0, 0]
    const ico = makeIco([opaqueBlack, opaqueBlack, opaqueBlack, opaqueBlack], [0b10000000, 0])
    const out = decodeIco(ico)!
    if (out.kind !== 'bgra') throw new Error('expected bitmap')
    // AND rows are bottom-up too: the first mask row is the bottom row.
    expect(out.data[2 * 4 + 3]).toBe(0)
    expect(out.data[0 * 4 + 3]).toBe(255)
  })
  it('returns embedded PNG data untouched', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    const dir = Buffer.alloc(22)
    dir.writeUInt16LE(1, 2)
    dir.writeUInt16LE(1, 4)
    dir[6] = 32
    dir[7] = 32
    dir.writeUInt32LE(png.length, 14)
    dir.writeUInt32LE(22, 18)
    const out = decodeIco(Buffer.concat([dir, png]))!
    expect(out.kind).toBe('png')
  })
  it('rejects garbage and truncated files', () => {
    expect(decodeIco(Buffer.from('not an icon at all'))).toBeNull()
    const ico = makeIco([[0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]])
    expect(decodeIco(ico.subarray(0, 30))).toBeNull()
  })
})
