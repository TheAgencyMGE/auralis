// The user's own new tab wallpapers: pictures and videos copied into the
// profile (so moving or deleting the original doesn't break them), served
// to Auralis' pages at /user-wallpapers/. Large photos are scaled to 2560 px
// on the way in, which keeps their decoded size (and memory) reasonable.
import { dialog, nativeImage } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { settings, userFile } from './context'
import { logger } from './log'
import type { CustomWallpaper } from '../shared/settings'
import type { BrowserWin } from './window'

const log = logger('wallpapers')

export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']
export const VIDEO_EXTS = ['mp4', 'm4v', 'webm', 'mov', 'ogv']
const MAX_IMAGE = 60 * 1024 * 1024
const MAX_VIDEO = 2 * 1024 * 1024 * 1024
const MAX_COUNT = 50
const MAX_SIDE = 2560

export const userWallpaperDir = () => userFile('wallpapers')

/** Resolve a served file name to a path inside the folder, or null. */
export function userWallpaperPath(name: string): string | null {
  if (!/^[a-f0-9]{16}(\.thumb)?\.[a-z0-9]{2,5}$/.test(name)) return null
  return path.join(userWallpaperDir(), name)
}

function toneOf(img: Electron.NativeImage): 'light' | 'dark' {
  const small = img.resize({ width: 32 })
  const bmp = small.toBitmap() // BGRA
  let sum = 0
  let n = 0
  for (let i = 0; i < bmp.length; i += 4) {
    sum += 0.0722 * bmp[i] + 0.7152 * bmp[i + 1] + 0.2126 * bmp[i + 2]
    n++
  }
  return n && sum / n / 255 < 0.42 ? 'dark' : 'light'
}

async function thumbnailFor(file: string, kind: 'image' | 'video'): Promise<Electron.NativeImage | null> {
  try {
    // Windows' own thumbnailer: it understands videos as well as pictures.
    const t = await nativeImage.createThumbnailFromPath(file, { width: 320, height: 180 })
    if (!t.isEmpty()) return t
  } catch {
    /* no shell thumbnail for this file */
  }
  if (kind === 'image') {
    const img = nativeImage.createFromPath(file)
    if (!img.isEmpty()) return img.resize({ width: 320 })
  }
  return null
}

async function importOne(src: string): Promise<CustomWallpaper | string> {
  const ext = path.extname(src).slice(1).toLowerCase()
  const kind = IMAGE_EXTS.includes(ext) ? 'image' : VIDEO_EXTS.includes(ext) ? 'video' : null
  const name = path.basename(src, path.extname(src)).slice(0, 80) || 'Wallpaper'
  if (!kind) return `“${name}” isn’t a picture or video Auralis can show.`
  const stat = await fs.stat(src)
  if (stat.size > (kind === 'image' ? MAX_IMAGE : MAX_VIDEO)) return `“${name}” is too large.`
  const id = crypto.randomBytes(8).toString('hex')
  await fs.mkdir(userWallpaperDir(), { recursive: true })

  let file = `${id}.${ext === 'jpeg' ? 'jpg' : ext}`
  // nativeImage reads PNG and JPEG; anything else (WebP, GIF, AVIF...) is
  // copied as it is and left to Chromium, which shows them all.
  const img = kind === 'image' && ext !== 'gif' ? nativeImage.createFromPath(src) : null
  if (img && !img.isEmpty()) {
    const { width, height } = img.getSize()
    if (Math.max(width, height) > MAX_SIDE || ext === 'bmp') {
      // Scale down (or convert) once, here, instead of on every new tab.
      const scaled = width >= height ? img.resize({ width: Math.min(width, MAX_SIDE), quality: 'best' }) : img.resize({ height: Math.min(height, MAX_SIDE), quality: 'best' })
      file = `${id}.jpg`
      await fs.writeFile(path.join(userWallpaperDir(), file), scaled.toJPEG(90))
    } else {
      await fs.copyFile(src, path.join(userWallpaperDir(), file))
    }
  } else {
    await fs.copyFile(src, path.join(userWallpaperDir(), file))
  }

  const thumb = await thumbnailFor(path.join(userWallpaperDir(), file), kind)
  if (thumb) await fs.writeFile(path.join(userWallpaperDir(), `${id}.thumb.jpg`), thumb.toJPEG(80))
  return { id, name, kind, file, thumb: !!thumb, tone: thumb ? toneOf(thumb) : 'light' }
}

export async function importWallpapers(win: BrowserWin): Promise<{ added: number; errors: string[]; canceled?: boolean }> {
  const r = await dialog.showOpenDialog(win.win, {
    title: 'Choose pictures or videos',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Pictures and videos', extensions: [...IMAGE_EXTS, ...VIDEO_EXTS] },
      { name: 'Pictures', extensions: IMAGE_EXTS },
      { name: 'Videos', extensions: VIDEO_EXTS }
    ]
  })
  if (r.canceled || !r.filePaths.length) return { added: 0, errors: [], canceled: true }
  const added: CustomWallpaper[] = []
  const errors: string[] = []
  const room = MAX_COUNT - settings.get().customWallpapers.length
  for (const src of r.filePaths.slice(0, Math.max(0, room))) {
    try {
      const w = await importOne(src)
      if (typeof w === 'string') errors.push(w)
      else added.push(w)
    } catch (err) {
      log.warn('import failed', src, err)
      errors.push(`“${path.basename(src)}” couldn’t be added.`)
    }
  }
  if (r.filePaths.length > room) errors.push(`You can keep up to ${MAX_COUNT} of your own wallpapers.`)
  if (added.length) {
    settings.set({
      customWallpapers: [...settings.get().customWallpapers, ...added],
      wallpaper: `custom:${added[added.length - 1].id}`
    })
  }
  return { added: added.length, errors }
}

export async function removeWallpaper(id: string): Promise<void> {
  const s = settings.get()
  const w = s.customWallpapers.find((x) => x.id === id)
  if (!w) return
  settings.set({
    customWallpapers: s.customWallpapers.filter((x) => x.id !== id),
    ...(s.wallpaper === `custom:${id}` ? { wallpaper: 'live:fields' } : {})
  })
  for (const name of [w.file, `${id}.thumb.jpg`]) {
    const p = userWallpaperPath(name)
    if (p) await fs.rm(p, { force: true }).catch(() => {})
  }
}
