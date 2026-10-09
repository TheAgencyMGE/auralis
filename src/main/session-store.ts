// Session restore. The window/tab snapshot is written (debounced) whenever
// tabs change, and a lock file marks a running instance so an unclean exit
// is detected on the next launch. Restored tabs start asleep, so a page that
// crashed the browser cannot crash it again on startup.
import fs from 'node:fs'
import { BrowserWin, type WindowSnapshot } from './window'
import { readJson, DebouncedWriter } from './json-store'
import { userFile } from './context'
import { logger } from './log'

const log = logger('session')

interface SessionFile {
  version: 1
  savedAt: number
  windows: WindowSnapshot[]
}

let writer: DebouncedWriter | null = null
/** Snapshot of the last window to close, so closing it then quitting keeps it. */
let lastClosed: WindowSnapshot | null = null
let quitting = false

const lockFile = () => userFile('running.lock')

function snapshot(): SessionFile {
  const windows = [...BrowserWin.all.values()].filter((w) => !w.incognito && !w.win.isDestroyed()).map((w) => w.snapshot())
  return { version: 1, savedAt: Date.now(), windows: windows.length ? windows : lastClosed ? [lastClosed] : [] }
}

export function initSessionStore(): { previous: SessionFile | null; unclean: boolean } {
  const unclean = fs.existsSync(lockFile())
  try {
    fs.writeFileSync(lockFile(), String(process.pid))
  } catch (err) {
    log.warn('lock file', err)
  }
  writer = new DebouncedWriter(userFile('session.json'), snapshot, 1000)
  const previous = readJson<SessionFile>(userFile('session.json'))
  if (unclean) log.warn('previous session did not exit cleanly')
  return { previous: previous?.version === 1 ? previous : null, unclean }
}

export function scheduleSave(): void {
  if (!quitting) writer?.schedule()
}

export function onWindowClosing(win: BrowserWin): void {
  if (win.incognito || quitting) return
  const others = [...BrowserWin.all.values()].filter((w) => w !== win && !w.incognito)
  // Closing the last normal window ends the session with that window in it.
  if (others.length === 0) lastClosed = win.snapshot()
}

export function onWindowClosed(_win: BrowserWin): void {
  if (!quitting) writer?.schedule()
}

export function flushOnQuit(): void {
  if (quitting) return
  // Snapshot while windows still exist, then stop further writes.
  writer?.flush()
  quitting = true
  try {
    fs.rmSync(lockFile(), { force: true })
  } catch {
    /* ignore */
  }
}
