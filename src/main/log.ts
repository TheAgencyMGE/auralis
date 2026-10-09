// Small rotating file logger. Writes to <userData>/logs/auralis.log and
// mirrors to the console in development.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

type Level = 'debug' | 'info' | 'warn' | 'error'
const MAX_BYTES = 1024 * 1024
let file: string | null = null
let stream: fs.WriteStream | null = null

function open(): void {
  if (stream || !app.isReady()) return
  const dir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  file = path.join(dir, 'auralis.log')
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) {
      fs.rmSync(file + '.1', { force: true })
      fs.renameSync(file, file + '.1')
    }
  } catch {
    /* rotation is best effort */
  }
  stream = fs.createWriteStream(file, { flags: 'a' })
}

function fmt(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}\n${v.stack ?? ''}`
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function write(level: Level, scope: string, parts: unknown[]): void {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${parts.map(fmt).join(' ')}`
  if (!app.isPackaged || level === 'error') (level === 'error' ? console.error : console.log)(line)
  open()
  stream?.write(line + '\n')
}

export function logger(scope: string) {
  return {
    debug: (...p: unknown[]) => !app.isPackaged && write('debug', scope, p),
    info: (...p: unknown[]) => write('info', scope, p),
    warn: (...p: unknown[]) => write('warn', scope, p),
    error: (...p: unknown[]) => write('error', scope, p)
  }
}

export function logFilePath(): string | null {
  return file
}
