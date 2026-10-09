// The Shield: one request pipeline per web session.
//
// Electron allows a single listener per webRequest event, so ad & tracker
// blocking (Ghostery's engine, MPL-2.0), HTTPS-First upgrades and Global
// Privacy Control all live here instead of competing for the hooks.
import { app, ipcMain, net, webContents, type Session, type IpcMainInvokeEvent } from 'electron'
import { ElectronBlocker, fromElectronDetails } from '@ghostery/adblocker-electron'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { settings, userFile } from './context'
import { logger } from './log'
import { siteKey, SCHEME } from '../shared/url'

const log = logger('shield')
const ENGINE_FILE = () => userFile('shield-engine.bin')
const ENGINE_MAX_AGE = 4 * 86_400_000

let engine: ElectronBlocker | null = null
let engineUpdated = 0

/** Per-webContents blocked request counts; read by tabs. */
const blockedCounts = new Map<number, number>()
type BlockListener = (webContentsId: number, count: number) => void
const blockListeners = new Set<BlockListener>()
export const onBlocked = (l: BlockListener) => (blockListeners.add(l), () => blockListeners.delete(l))
export const blockedFor = (id: number) => blockedCounts.get(id) ?? 0
export const resetBlocked = (id: number) => blockedCounts.delete(id)

/** Hosts the user chose to load over plain HTTP this session (HTTPS-First fallback). */
const httpAllowed = new Set<string>()
export const allowHttpFor = (host: string) => httpAllowed.add(host)
/** webContentsId → the http URL we upgraded, so a failed upgrade can offer a fallback. */
const upgraded = new Map<number, string>()
export const upgradedFrom = (id: number) => upgraded.get(id) ?? null
export const clearUpgrade = (id: number) => upgraded.delete(id)

let totalBlocked = 0
export function shieldStats() {
  return { ready: !!engine, updated: engineUpdated, totalBlocked }
}

export function isShieldActiveFor(url: string): boolean {
  const s = settings.get()
  if (!s.shieldEnabled || !/^https?:/.test(url)) return false
  return !s.shieldAllowlist.includes(siteKey(url))
}

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.test') ||
    host.endsWith('.internal') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.startsWith('[') ||
    !host.includes('.')
  )
}

export async function initShield(): Promise<void> {
  try {
    const stat = await fs.stat(ENGINE_FILE()).catch(() => null)
    if (stat) {
      engine = ElectronBlocker.deserialize(new Uint8Array(await fs.readFile(ENGINE_FILE())))
      engineUpdated = stat.mtimeMs
      log.info('engine loaded from cache')
    }
    if (!stat || Date.now() - stat.mtimeMs > ENGINE_MAX_AGE) void refreshEngine()
  } catch (err) {
    log.warn('cached engine unusable, refetching', err)
    void refreshEngine()
  }
}

async function refreshEngine(): Promise<void> {
  try {
    // net.fetch uses Chromium's network stack (system proxy, certificates).
    const fresh = await ElectronBlocker.fromPrebuiltAdsAndTracking((url: Parameters<typeof fetch>[0], init?: RequestInit) =>
      net.fetch(String(url), init)
    )
    engine = fresh
    engineUpdated = Date.now()
    await fs.writeFile(ENGINE_FILE(), fresh.serialize())
    log.info('engine updated')
  } catch (err) {
    log.warn('engine update failed (offline?)', err)
  }
}

function topUrlOf(webContentsId: number | undefined): string {
  if (webContentsId == null) return ''
  const wc = webContents.fromId(webContentsId)
  return wc && !wc.isDestroyed() ? wc.getURL() : ''
}

function bump(id: number): void {
  const n = (blockedCounts.get(id) ?? 0) + 1
  blockedCounts.set(id, n)
  totalBlocked++
  for (const l of blockListeners) l(id, n)
}

export function installShield(ses: Session): void {
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    try {
      const url = details.url
      // HTTPS-First: upgrade top-level http navigations to public hosts.
      if (details.resourceType === 'mainFrame' && url.startsWith('http:') && settings.get().httpsFirst) {
        const u = new URL(url)
        if (!isLocalHost(u.hostname) && !httpAllowed.has(u.hostname)) {
          if (details.webContentsId != null) upgraded.set(details.webContentsId, url)
          u.protocol = 'https:'
          if (u.port === '80') u.port = ''
          return callback({ redirectURL: u.href })
        }
      }
      if (!engine || details.resourceType === 'mainFrame' || !/^(https?|wss?):/.test(url)) return callback({})
      const top = topUrlOf(details.webContentsId)
      if (top.startsWith(`${SCHEME}:`) || !isShieldActiveFor(top || details.referrer || '')) return callback({})
      const request = fromElectronDetails(details)
      if (request.type === 'other') request.guessTypeOfRequest()
      const { redirect, match } = engine.match(request)
      if (redirect) {
        if (details.webContentsId != null) bump(details.webContentsId)
        return callback({ redirectURL: redirect.dataUrl })
      }
      if (match) {
        if (details.webContentsId != null) bump(details.webContentsId)
        return callback({ cancel: true })
      }
      callback({})
    } catch (err) {
      log.error('onBeforeRequest', err)
      callback({})
    }
  })

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    if (settings.get().globalPrivacyControl && /^https?:/.test(details.url)) {
      details.requestHeaders['Sec-GPC'] = '1'
    }
    callback({ requestHeaders: details.requestHeaders })
  })

  ses.webRequest.onHeadersReceived((details, callback) => {
    try {
      if (!engine || (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame')) return callback({})
      const top = details.resourceType === 'mainFrame' ? details.url : topUrlOf(details.webContentsId)
      if (!isShieldActiveFor(top)) return callback({})
      const directives = engine.getCSPDirectives(fromElectronDetails(details))
      if (!directives) return callback({})
      const headers = { ...(details.responseHeaders ?? {}) }
      const policies = directives.split(';').map((p) => p.trim())
      for (const name of Object.keys(headers)) {
        if (name.toLowerCase() === 'content-security-policy') {
          policies.push(...headers[name])
          delete headers[name]
        }
      }
      headers['Content-Security-Policy'] = [policies.join(';')]
      callback({ responseHeaders: headers })
    } catch (err) {
      log.error('onHeadersReceived', err)
      callback({})
    }
  })

  // Cosmetic filtering: Ghostery's preload asks for element-hiding rules.
  try {
    const preload = createRequire(__filename).resolve('@ghostery/adblocker-electron-preload')
    ses.registerPreloadScript({ type: 'frame', filePath: preload })
  } catch (err) {
    log.warn('cosmetic preload unavailable', err)
  }
}

let ipcInstalled = false
export function installShieldIpc(): void {
  if (ipcInstalled) return
  ipcInstalled = true
  ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (event: IpcMainInvokeEvent, url: unknown, msg: unknown) => {
    if (!engine || typeof url !== 'string') return
    const top = event.sender.getURL()
    if (!isShieldActiveFor(top)) return
    return engine.onInjectCosmeticFilters(event, url, msg as Parameters<ElectronBlocker['onInjectCosmeticFilters']>[2])
  })
  ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', () => engine?.config.enableMutationObserver ?? false)
}

app.on('web-contents-created', (_e, wc) => {
  const id = wc.id
  wc.once('destroyed', () => {
    blockedCounts.delete(id)
    upgraded.delete(id)
  })
})
