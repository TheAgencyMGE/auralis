// Atomic JSON persistence: write to a temp file, fsync, then rename over the
// original, keeping the previous good copy as .bak. A crash mid-write can
// never leave a truncated file behind.
import fs from 'node:fs'
import path from 'node:path'
import { logger } from './log'

const log = logger('store')

export function readJson<T>(file: string): T | null {
  for (const f of [file, file + '.bak']) {
    try {
      if (!fs.existsSync(f)) continue
      return JSON.parse(fs.readFileSync(f, 'utf8')) as T
    } catch (err) {
      log.warn(`unreadable ${path.basename(f)}, trying backup`, err)
    }
  }
  return null
}

export function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`
  const json = JSON.stringify(data)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const fd = fs.openSync(tmp, 'w')
  try {
    fs.writeSync(fd, json)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  if (fs.existsSync(file)) {
    try {
      fs.copyFileSync(file, file + '.bak')
    } catch {
      /* backup is best effort */
    }
  }
  fs.renameSync(tmp, file)
}

/** Coalesces frequent saves into one write after `delay` ms. */
export class DebouncedWriter {
  private timer: NodeJS.Timeout | null = null
  constructor(
    private readonly file: string,
    private readonly snapshot: () => unknown,
    private readonly delay = 800
  ) {}
  schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), this.delay)
  }
  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    try {
      writeJsonAtomic(this.file, this.snapshot())
    } catch (err) {
      log.error('write failed', this.file, err)
    }
  }
}
