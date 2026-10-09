// Downloads: live DownloadItems, persisted history, taskbar progress.
import { BrowserWindow, shell, type DownloadItem, type Session } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { broadcast, ctx, settings } from './context'
import type { DownloadItemState } from '../shared/types'
import { logger } from './log'

const log = logger('downloads')

interface Live {
  item: DownloadItem
  state: DownloadItemState
  lastBytes: number
  lastTime: number
  incognito: boolean
}

const live = new Map<string, Live>()
const sessionsWired = new WeakSet<Session>()
let notifyTimer: NodeJS.Timeout | null = null
let onComplete: (d: DownloadItemState) => void = () => {}
export const onDownloadComplete = (fn: typeof onComplete) => (onComplete = fn)
let onStarted: (d: DownloadItemState, incognito: boolean) => void = () => {}
export const onDownloadStarted = (fn: typeof onStarted) => (onStarted = fn)
let onChanged: () => void = () => {}
export const onDownloadsChanged = (fn: typeof onChanged) => (onChanged = fn)

/** Incognito downloads are never written to the persistent list. */
const ephemeral = new Map<string, DownloadItemState>()

export function uniquePath(dir: string, filename: string): string {
  const safe = filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '_').slice(0, 200) || 'download'
  const ext = path.extname(safe)
  const base = safe.slice(0, safe.length - ext.length)
  let candidate = path.join(dir, safe)
  for (let i = 1; fs.existsSync(candidate) && i < 1000; i++) candidate = path.join(dir, `${base} (${i})${ext}`)
  return candidate
}

export function installDownloads(ses: Session, incognito: boolean): void {
  if (sessionsWired.has(ses)) return
  sessionsWired.add(ses)
  ses.on('will-download', (_e, item) => {
    const s = settings.get()
    const dir = s.downloadDir && fs.existsSync(s.downloadDir) ? s.downloadDir : path.join(process.env.USERPROFILE ?? '.', 'Downloads')
    if (s.askWhereToSave) item.setSaveDialogOptions({ defaultPath: path.join(dir, item.getFilename()) })
    else item.setSavePath(uniquePath(dir, item.getFilename()))

    const id = randomUUID()
    const state: DownloadItemState = {
      id,
      url: item.getURL(),
      filename: path.basename(item.getSavePath() || item.getFilename()),
      path: item.getSavePath(),
      state: 'progressing',
      received: 0,
      total: item.getTotalBytes(),
      speed: 0,
      startTime: Date.now(),
      endTime: null
    }
    const entry: Live = { item, state, lastBytes: 0, lastTime: Date.now(), incognito }
    live.set(id, entry)
    persist(entry)
    onStarted(state, incognito)

    item.on('updated', (_ev, st) => {
      const now = Date.now()
      const received = item.getReceivedBytes()
      const dt = (now - entry.lastTime) / 1000
      if (dt >= 0.5) {
        state.speed = Math.max(0, (received - entry.lastBytes) / dt)
        entry.lastBytes = received
        entry.lastTime = now
      }
      state.received = received
      state.total = item.getTotalBytes()
      state.path = item.getSavePath()
      state.filename = path.basename(state.path || item.getFilename())
      state.state = st === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing'
      notify()
    })
    item.once('done', (_ev, st) => {
      state.state = st === 'completed' ? 'completed' : st === 'cancelled' ? 'cancelled' : 'interrupted'
      state.received = item.getReceivedBytes()
      state.path = item.getSavePath()
      state.filename = path.basename(state.path || item.getFilename())
      state.endTime = Date.now()
      state.speed = 0
      persist(entry)
      if (state.state === 'completed') onComplete(state)
      log.info('download', state.state, state.filename)
      notify(true)
    })
    notify(true)
  })
}

function persist(entry: Live): void {
  if (entry.incognito) {
    ephemeral.set(entry.state.id, entry.state)
    return
  }
  try {
    ctx.downloads.upsert(entry.state)
  } catch (err) {
    log.error('persist failed', err)
  }
}

function notify(now = false): void {
  const run = () => {
    notifyTimer = null
    const list = listDownloads()
    broadcast('downloads', list)
    updateTaskbar()
    onChanged()
  }
  if (now) {
    if (notifyTimer) clearTimeout(notifyTimer)
    run()
  } else if (!notifyTimer) notifyTimer = setTimeout(run, 250)
}

function updateTaskbar(): void {
  const active = [...live.values()].filter((l) => l.state.state === 'progressing' || l.state.state === 'paused')
  const total = active.reduce((a, l) => a + l.state.total, 0)
  const received = active.reduce((a, l) => a + l.state.received, 0)
  const paused = active.length > 0 && active.every((l) => l.state.state === 'paused')
  for (const w of BrowserWindow.getAllWindows()) {
    if (w.isDestroyed()) continue
    if (!active.length) w.setProgressBar(-1)
    else if (total <= 0) w.setProgressBar(2, { mode: 'indeterminate' })
    else w.setProgressBar(received / total, { mode: paused ? 'paused' : 'normal' })
  }
}

export function listDownloads(): DownloadItemState[] {
  const stored = ctx.downloads.list()
  const byId = new Map(stored.map((d) => [d.id, d]))
  for (const l of live.values()) byId.set(l.state.id, { ...l.state })
  for (const e of ephemeral.values()) byId.set(e.id, e)
  return [...byId.values()].sort((a, b) => b.startTime - a.startTime)
}

export function downloadsSummary(): { active: number; progress: number; recent: number } {
  const active = [...live.values()].filter((l) => l.state.state === 'progressing' || l.state.state === 'paused')
  const total = active.reduce((a, l) => a + l.state.total, 0)
  const received = active.reduce((a, l) => a + l.state.received, 0)
  const recent = [...live.values()].filter((l) => l.state.endTime && Date.now() - l.state.endTime < 60_000).length
  return { active: active.length, progress: total > 0 ? received / total : active.length ? -1 : 0, recent }
}

export function downloadAction(id: string, action: string): boolean {
  const l = live.get(id)
  const d = l?.state ?? listDownloads().find((x) => x.id === id)
  if (!d) return false
  switch (action) {
    case 'open':
      if (d.state === 'completed' && fs.existsSync(d.path)) void shell.openPath(d.path)
      return true
    case 'show':
      if (fs.existsSync(d.path)) shell.showItemInFolder(d.path)
      else if (d.path) void shell.openPath(path.dirname(d.path))
      return true
    case 'pause':
      l?.item.pause()
      break
    case 'resume':
      if (l?.item.canResume()) l.item.resume()
      break
    case 'cancel':
      l?.item.cancel()
      break
    case 'remove':
      if (l && (l.state.state === 'progressing' || l.state.state === 'paused')) l.item.cancel()
      live.delete(id)
      ephemeral.delete(id)
      ctx.downloads.remove(id)
      break
    case 'retry': {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      win?.webContents.session.downloadURL(d.url)
      break
    }
    default:
      return false
  }
  notify(true)
  return true
}

export function clearFinishedDownloads(): void {
  for (const [id, l] of live) if (l.state.state !== 'progressing' && l.state.state !== 'paused') live.delete(id)
  for (const [id, e] of ephemeral) if (e.state !== 'progressing' && e.state !== 'paused') ephemeral.delete(id)
  ctx.downloads.clearFinished()
  notify(true)
}

export function hasActiveDownloads(): boolean {
  return [...live.values()].some((l) => l.state.state === 'progressing' || l.state.state === 'paused')
}
