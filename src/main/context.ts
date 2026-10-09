// Process-wide services, created once at startup. Modules import `ctx`
// rather than each other to keep the dependency graph flat.
import { app, webContents } from 'electron'
import path from 'node:path'
import type { Db } from './data/db'
import type { HistoryStore } from './data/history'
import type { BookmarkStore } from './data/bookmarks'
import type { DownloadStore } from './data/downloads'
import type { PermissionStore } from './data/permissions'
import type { FaviconStore } from './data/favicons'
import { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings, type Settings } from '../shared/settings'
import { readJson, DebouncedWriter } from './json-store'
import { IPC_EVENT, type EventName } from '../shared/ipc'
import { SCHEME } from '../shared/url'

export interface Ctx {
  db: Db
  history: HistoryStore
  bookmarks: BookmarkStore
  downloads: DownloadStore
  permissions: PermissionStore
  favicons: FaviconStore
}

export const ctx = {} as Ctx

export const userFile = (name: string) => path.join(app.getPath('userData'), name)

// ---- settings ------------------------------------------------------------

type SettingsListener = (next: Settings, prev: Settings) => void

class SettingsService {
  private value: Settings = DEFAULT_SETTINGS
  private writer!: DebouncedWriter
  private listeners = new Set<SettingsListener>()

  load(): void {
    this.value = sanitizeSettings(readJson(userFile('settings.json')) ?? {})
    if (!this.value.downloadDir) this.value = { ...this.value, downloadDir: app.getPath('downloads') }
    this.writer = new DebouncedWriter(userFile('settings.json'), () => this.value, 300)
  }

  get(): Settings {
    return this.value
  }

  set(patch: unknown): Settings {
    const prev = this.value
    this.value = mergeSettings(prev, patch)
    this.writer.schedule()
    for (const l of this.listeners) l(this.value, prev)
    broadcast('settings', this.value)
    return this.value
  }

  onChange(l: SettingsListener): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  flush(): void {
    this.writer?.flush()
  }
}

export const settings = new SettingsService()

/** Send an event to every Auralis-owned renderer (chrome, overlay, internal pages). */
export function broadcast(name: EventName, payload: unknown): void {
  for (const wc of webContents.getAllWebContents()) {
    if (wc.isDestroyed()) continue
    if (!wc.getURL().startsWith(`${SCHEME}:`)) continue
    wc.send(IPC_EVENT, name, payload)
  }
}
