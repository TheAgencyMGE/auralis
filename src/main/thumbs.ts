// Tab preview images kept on disk, so tabs restored asleep (or never shown)
// still have a picture in previews, Tab Flip and Flip 3D. Small JPEGs keyed
// by a hash of the page address; InPrivate windows never write here.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { userFile } from './context'
import { logger } from './log'

const log = logger('thumbs')
const DIR = () => userFile('thumbnails')
const KEEP = 300
const PREFIX = 'data:image/jpeg;base64,'

const fileFor = (url: string) => path.join(DIR(), crypto.createHash('sha1').update(url).digest('hex') + '.jpg')
const cacheable = (url: string) => /^https?:/.test(url)

export function saveThumb(url: string, dataUrl: string): void {
  if (!cacheable(url) || !dataUrl.startsWith(PREFIX)) return
  fs.promises
    .mkdir(DIR(), { recursive: true })
    .then(() => fs.promises.writeFile(fileFor(url), Buffer.from(dataUrl.slice(PREFIX.length), 'base64')))
    .catch((err) => log.debug('save failed', err))
}

export function cachedThumb(url: string): string | null {
  if (!cacheable(url)) return null
  try {
    return PREFIX + fs.readFileSync(fileFor(url)).toString('base64')
  } catch {
    return null
  }
}

/** Keep the newest few hundred; run once at startup. */
export async function pruneThumbs(): Promise<void> {
  try {
    const dir = DIR()
    const files = await fs.promises.readdir(dir)
    if (files.length <= KEEP) return
    const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.promises.stat(path.join(dir, f))).mtimeMs })))
    stats.sort((a, b) => b.t - a.t)
    await Promise.all(stats.slice(KEEP).map((s) => fs.promises.rm(path.join(dir, s.f), { force: true })))
  } catch {
    /* no folder yet */
  }
}
