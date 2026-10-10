// Chrome extensions: installed from the Chrome Web Store (electron-chrome-
// web-store, MIT) or loaded unpacked, with the chrome.* APIs Electron lacks
// (tabs, windows, action, contextMenus, ...) from electron-chrome-extensions
// (GPL-3.0). Extensions run in the normal browsing session only; InPrivate
// windows never see them, as in Chrome's default.
//
// Toolbar buttons are drawn by the chrome itself from the library's action
// state; their icons travel as data: URLs, like favicons.
import { app, BrowserWindow, dialog, session, type BaseWindow, type MenuItem, type Session, type WebContents } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { ElectronChromeExtensions } from 'electron-chrome-extensions'
import { BrowserWin, type MenuSpec } from './window'
import type { Tab } from './tab'
import { settings } from './context'
import { logger } from './log'
import { NEW_TAB_URL } from '../shared/url'
import type { ExtensionAction, ExtensionInfo, Rect } from '../shared/types'

const log = logger('extensions')

let ext: ElectronChromeExtensions | null = null
let store: typeof import('electron-chrome-web-store') | null = null
const ses = (): Session => session.defaultSession

/** The library's action state; it has no public accessor for it. */
interface ActionDetails {
  title?: string
  text?: string
  color?: string
  popup?: string
  icon?: unknown
  tabs: Record<string, { title?: string; text?: string; color?: string; icon?: unknown }>
}
interface BrowserActionApi {
  actionMap: Map<string, ActionDetails>
  onUpdate(): void
  activateClick(details: { extensionId: string; tabId: number; anchorRect: Rect; alignment?: string }): void
  handleCRXRequest(request: { url: string }): Response | Promise<Response>
}
const actionApi = (): BrowserActionApi | null => (ext as unknown as { api?: { browserAction?: BrowserActionApi } })?.api?.browserAction ?? null

interface Popup {
  browserWindow?: BrowserWindow
  hidden: boolean
  isDestroyed(): boolean
  setSize(size: { width: number; height: number }): void
  updatePosition(): void
  show(): void
}

/**
 * The library sizes popups from 'preferred-size-changed', which Electron 44
 * doesn't deliver, leaving them hidden at their minimum size. Measure the
 * document ourselves instead, and keep following it while the popup lays
 * itself out.
 */
function fitPopup(popup: Popup, wc: WebContents): void {
  let last = ''
  const fit = async () => {
    if (popup.isDestroyed() || wc.isDestroyed()) return
    try {
      const r = (await wc.executeJavaScript(
        '({ w: Math.ceil(Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)), h: Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)) })'
      )) as { w: number; h: number }
      if (popup.isDestroyed()) return
      const key = `${r.w}x${r.h}`
      if (key !== last) {
        last = key
        popup.setSize({ width: r.w, height: r.h })
        popup.updatePosition()
      }
      if (popup.hidden) popup.show()
    } catch {
      /* closed while measuring */
    }
  }
  let ticks = 0
  const timer = setInterval(() => {
    if (++ticks > 40 || popup.isDestroyed()) return clearInterval(timer)
    void fit()
  }, 150)
  wc.on('did-finish-load', () => void fit())
}

const winOf = (bw: BaseWindow | null | undefined) => [...BrowserWin.all.values()].find((w) => w.win === bw) ?? null
const tabOf = (wc: WebContents): [BrowserWin, Tab] | null => {
  for (const w of BrowserWin.all.values()) {
    const t = w.tabs.find((x) => x.wc === wc)
    if (t) return [w, t]
  }
  return null
}
const normalWindow = () => {
  const last = BrowserWin.lastFocused
  return last && !last.incognito ? last : ([...BrowserWin.all.values()].find((w) => !w.incognito) ?? null)
}

export async function initExtensions(): Promise<void> {
  const started = Date.now()
  // Imported only now (after app ready) so the library doesn't re-register
  // privileged schemes over Auralis' own.
  const { ElectronChromeExtensions } = await import('electron-chrome-extensions')
  store = await import('electron-chrome-web-store')
  ext = new ElectronChromeExtensions({
    license: 'GPL-3.0',
    session: ses(),
    async createTab(details) {
      const w = (typeof details.windowId === 'number' ? winOf(BrowserWindow.fromId(details.windowId)) : null) ?? normalWindow() ?? new BrowserWin({ initialUrls: [] })
      const tab = w.createTab({ url: details.url || NEW_TAB_URL }, { activate: details.active !== false })
      tab.ensureLoaded()
      return [tab.wc!, w.win as BrowserWindow]
    },
    selectTab(wc) {
      // The library also "selects" tabs while we're only registering them.
      if (quiet) return
      const found = tabOf(wc)
      if (found) found[0].activate(found[1])
    },
    removeTab(wc) {
      // Also called when a tab's page is destroyed (closing, or going to
      // sleep); only a live page is a request to close.
      if (wc.isDestroyed()) return
      const found = tabOf(wc)
      if (found) found[0].closeTab(found[1])
    },
    async createWindow(details) {
      const urls = typeof details.url === 'string' ? [details.url] : Array.isArray(details.url) ? details.url : undefined
      return new BrowserWin({ initialUrls: urls, incognito: false }).win
    },
    removeWindow(bw) {
      winOf(bw)?.win.close()
    }
  })

  // Action popups are small windows the library owns; anything they try to
  // open goes into a normal tab instead of a bare Electron window.
  ext.on('browser-action-popup-created', (popup: Popup) => {
    const wc = popup.browserWindow?.webContents
    if (!wc) return
    wc.setWindowOpenHandler(({ url }) => {
      if (/^(https?|chrome-extension):/.test(url)) normalWindow()?.createTab({ url })
      return { action: 'deny' }
    })
    fitPopup(popup, wc)
  })

  const api = actionApi()
  if (api) {
    const original = api.onUpdate.bind(api)
    api.onUpdate = () => {
      original()
      changed()
    }
  }
  ses().extensions.on('extension-loaded', changed)
  ses().extensions.on('extension-unloaded', changed)

  await store.installChromeWebStore({
    session: ses(),
    autoUpdate: true,
    beforeInstall: async (details) => ({ action: (await confirmInstall(details.localizedName, details.manifest, details.frame)) ? 'allow' : 'deny' })
  })
  for (const dir of settings.get().unpackedExtensions) {
    await ses()
      .extensions.loadExtension(dir, { allowFileAccess: false })
      .catch((err) => log.warn('unpacked extension failed to load', dir, err))
  }
  log.info(`extensions ready: ${ses().extensions.getAllExtensions().length} loaded in ${Date.now() - started} ms`)
  changed()
}

export function hasInstalledExtensions(): boolean {
  if (settings.get().unpackedExtensions.length) return true
  try {
    return fs.readdirSync(path.join(app.getPath('userData'), 'Extensions')).length > 0
  } catch {
    return false
  }
}

// ---- tabs ---------------------------------------------------------------------------------

/** Set while Auralis itself tells the library about tabs, so its bookkeeping
 *  can't switch the tab the user is looking at. */
let quiet = false
function quietly(fn: () => void): void {
  quiet = true
  try {
    fn()
  } finally {
    quiet = false
  }
}

export function trackTab(win: BrowserWin, tab: Tab): void {
  const wc = tab.wc
  if (!ext || !wc || win.incognito || wc.session !== ses()) return
  quietly(() => {
    ext!.addTab(wc, win.win)
    // Registering a tab can make the library think it's the active one.
    const active = win.activeTab?.wc
    if (active && active !== wc && active.session === ses()) {
      ext!.addTab(active, win.win)
      ext!.selectTab(active)
    }
  })
}

export function selectedTab(win: BrowserWin, tab: Tab): void {
  const wc = tab.wc
  if (!ext || !wc || win.incognito || wc.session !== ses()) return
  quietly(() => {
    ext!.addTab(wc, win.win)
    ext!.selectTab(wc)
  })
}

export function contextMenuItems(wc: WebContents, params: Electron.ContextMenuParams, win: BrowserWin): MenuSpec[] {
  if (!ext || win.incognito) return []
  const conv = (item: MenuItem): MenuSpec =>
    item.type === 'separator'
      ? { type: 'separator' }
      : {
          label: item.label,
          disabled: !item.enabled,
          checked: item.type === 'checkbox' || item.type === 'radio' ? item.checked : undefined,
          click: item.submenu ? undefined : () => item.click(undefined as never, win.win as BrowserWindow, undefined as never),
          submenu: item.submenu?.items.map(conv)
        }
  try {
    return ext.getContextMenuItems(wc, params).map(conv)
  } catch {
    return []
  }
}

// ---- toolbar actions ----------------------------------------------------------------------

const iconCache = new Map<string, string>()
const iconPending = new Set<string>()
let notifyTimer: NodeJS.Timeout | null = null

function changed(): void {
  if (notifyTimer) return
  notifyTimer = setTimeout(() => {
    notifyTimer = null
    for (const w of BrowserWin.all.values()) w.pushState()
  }, 30)
}

/** Toolbar buttons for the active tab of a window. */
export function actionsFor(win: BrowserWin): ExtensionAction[] {
  const api = actionApi()
  if (!api || win.incognito) return []
  const tabId = win.activeTab?.wc?.id ?? -1
  const out: ExtensionAction[] = []
  for (const [id, a] of api.actionMap) {
    const extension = ses().extensions.getExtension(id)
    if (!extension) continue
    const t = a.tabs[tabId] ?? {}
    const iconDetails = t.icon ?? a.icon
    const key = `${id}:${JSON.stringify(iconDetails ?? null)}`
    if (!iconCache.has(key) && !iconPending.has(key)) void loadIcon(api, id, tabId, key)
    out.push({
      id,
      title: t.title ?? a.title ?? extension.name,
      badge: t.text ?? a.text ?? '',
      badgeColor: t.color ?? a.color ?? '#d23',
      icon: iconCache.get(key) ?? null
    })
  }
  return out
}

async function loadIcon(api: BrowserActionApi, id: string, tabId: number, key: string): Promise<void> {
  iconPending.add(key)
  try {
    const res = await api.handleCRXRequest({ url: `crx://extension-icon/${id}/32/2?tabId=${tabId}` })
    if (res.ok) {
      iconCache.set(key, 'data:image/png;base64,' + Buffer.from(await res.arrayBuffer()).toString('base64'))
      if (iconCache.size > 200) iconCache.delete(iconCache.keys().next().value!)
      changed()
    }
  } catch (err) {
    log.debug('icon failed', id, err)
  } finally {
    iconPending.delete(key)
  }
}

export function activateAction(win: BrowserWin, id: string, anchor: Rect): void {
  const api = actionApi()
  const tab = win.activeTab
  if (!api || !tab?.wc || win.incognito) return
  quietly(() => ext!.addTab(tab.wc!, win.win))
  try {
    api.activateClick({ extensionId: id, tabId: tab.wc.id, anchorRect: anchor, alignment: 'bottom left' })
  } catch (err) {
    log.warn('action failed', id, err)
  }
}

export function actionMenu(win: BrowserWin, id: string, anchor: Rect): void {
  const e = ses().extensions.getExtension(id)
  if (!e) return
  const options = optionsUrl(id)
  win.menu(
    anchor,
    [
      { type: 'header', label: e.name },
      { label: 'Options', disabled: !options, click: () => options && win.createTab({ url: options }) },
      { label: 'Manage extensions', icon: 'extensions', click: () => void import('./commands').then((m) => m.openInternal(win, 'extensions')) },
      { type: 'separator' },
      { label: 'Remove from Auralis…', danger: true, click: () => void removeExtension(id, win) }
    ],
    'end'
  )
}

// ---- management ---------------------------------------------------------------------------

function manifestOf(id: string): chrome.runtime.Manifest | null {
  return (ses().extensions.getExtension(id)?.manifest as chrome.runtime.Manifest | undefined) ?? null
}

function optionsUrl(id: string): string | null {
  const m = manifestOf(id) as (chrome.runtime.Manifest & { options_ui?: { page?: string }; options_page?: string }) | null
  const page = m?.options_ui?.page ?? m?.options_page
  return page ? `chrome-extension://${id}/${page.replace(/^\//, '')}` : null
}

function iconOf(id: string): string | null {
  const e = ses().extensions.getExtension(id)
  const icons = (e?.manifest as { icons?: Record<string, string> } | undefined)?.icons
  if (!e || !icons) return null
  const best = Object.entries(icons).sort((a, b) => Number(b[0]) - Number(a[0]))[0]
  const file = best && path.resolve(e.path, best[1].replace(/^\//, ''))
  if (!file || !file.startsWith(path.resolve(e.path))) return null
  try {
    const ext = path.extname(file).toLowerCase()
    const type = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    return `data:${type};base64,` + fs.readFileSync(file).toString('base64')
  } catch {
    return null
  }
}

export function listExtensions(): ExtensionInfo[] {
  const unpacked = new Set(settings.get().unpackedExtensions.map((p) => path.resolve(p)))
  return ses()
    .extensions.getAllExtensions()
    .map((e) => {
      const m = e.manifest as { description?: string; manifest_version?: number }
      return {
        id: e.id,
        name: e.name,
        version: e.version,
        description: (m.description ?? '').slice(0, 300),
        manifestVersion: m.manifest_version ?? 2,
        icon: iconOf(e.id),
        options: !!optionsUrl(e.id),
        unpacked: unpacked.has(path.resolve(e.path))
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function openOptions(win: BrowserWin, id: string): void {
  const url = optionsUrl(id)
  if (url) win.createTab({ url })
}

export async function removeExtension(id: string, win?: BrowserWin): Promise<boolean> {
  const e = ses().extensions.getExtension(id)
  if (!e) return false
  const go = async () => {
    const unpacked = settings.get().unpackedExtensions
    const isUnpacked = unpacked.some((p) => path.resolve(p) === path.resolve(e.path))
    if (isUnpacked) {
      ses().extensions.removeExtension(id)
      settings.set({ unpackedExtensions: unpacked.filter((p) => path.resolve(p) !== path.resolve(e.path)) })
    } else {
      await store?.uninstallExtension(id, { session: ses() })
    }
    changed()
  }
  if (!win) {
    await go()
    return true
  }
  return new Promise((resolve) =>
    win.confirm(
      { title: `Remove “${e.name}”?`, message: 'Its settings and data in Auralis are deleted too.', confirm: 'Remove', cancel: 'Cancel' },
      () => void go().then(() => resolve(true)),
      () => resolve(false)
    )
  )
}

export async function loadUnpacked(win: BrowserWin): Promise<{ name?: string; error?: string; canceled?: boolean }> {
  const r = await dialog.showOpenDialog(win.win, { title: 'Choose an extension folder', properties: ['openDirectory'] })
  const dir = r.filePaths[0]
  if (r.canceled || !dir) return { canceled: true }
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) return { error: 'That folder doesn’t contain a manifest.json.' }
  try {
    const e = await ses().extensions.loadExtension(dir, { allowFileAccess: false })
    const list = settings.get().unpackedExtensions
    if (!list.includes(dir)) settings.set({ unpackedExtensions: [...list, dir] })
    changed()
    return { name: e.name }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateAll(): Promise<void> {
  await store?.updateExtensions(ses())
}

// ---- install prompt ------------------------------------------------------------------------

const PERMISSION_TEXT: Record<string, string> = {
  tabs: 'Read your browsing history',
  history: 'Read and change your browsing history',
  bookmarks: 'Read and change your favorites',
  downloads: 'Manage your downloads',
  cookies: 'Read and change cookies',
  clipboardRead: 'Read data you copy and paste',
  clipboardWrite: 'Change data you copy and paste',
  geolocation: 'Detect your location',
  notifications: 'Show notifications',
  management: 'Manage your extensions',
  nativeMessaging: 'Communicate with programs on this computer',
  proxy: 'Control your proxy settings',
  privacy: 'Change your privacy settings',
  webRequest: 'Watch the requests pages make',
  declarativeNetRequest: 'Block content on any page',
  declarativeNetRequestWithHostAccess: 'Block content on any page',
  debugger: 'Access the page debugger',
  topSites: 'Read your most visited sites'
}

function describePermissions(manifest: chrome.runtime.Manifest): string[] {
  const m = manifest as { permissions?: unknown[]; host_permissions?: unknown[]; content_scripts?: { matches?: string[] }[] }
  const perms = (m.permissions ?? []).filter((p): p is string => typeof p === 'string')
  const hosts = [...(m.host_permissions ?? []), ...perms.filter((p) => p.includes('://') || p === '<all_urls>'), ...(m.content_scripts ?? []).flatMap((c) => c.matches ?? [])].filter(
    (p): p is string => typeof p === 'string'
  )
  const out: string[] = []
  if (hosts.some((h) => h === '<all_urls>' || h.startsWith('*://*/') || h.startsWith('http://*/') || h.startsWith('https://*/'))) out.push('Read and change all your data on all websites')
  else if (hosts.length) out.push(`Read and change your data on ${[...new Set(hosts.map((h) => h.replace(/^[^:]+:\/\//, '').replace(/\/.*$/, '')))].slice(0, 3).join(', ')}`)
  for (const p of perms) if (PERMISSION_TEXT[p] && !out.includes(PERMISSION_TEXT[p])) out.push(PERMISSION_TEXT[p])
  return out
}

function confirmInstall(name: string, manifest: chrome.runtime.Manifest, frame: Electron.WebFrameMain): Promise<boolean> {
  const wc = BrowserWin.all.size ? [...BrowserWin.all.values()].map((w) => w.tabs.find((t) => t.wc?.mainFrame === frame)).find(Boolean) : null
  const win = (wc ? [...BrowserWin.all.values()].find((w) => w.tabs.includes(wc)) : null) ?? normalWindow()
  if (!win) return Promise.resolve(false)
  const perms = describePermissions(manifest)
  return new Promise((resolve) =>
    win.confirm(
      {
        title: `Add “${name}” to Auralis?`,
        message: perms.length ? `It can:\n• ${perms.join('\n• ')}` : 'It doesn’t ask for any special permissions.',
        confirm: 'Add extension',
        cancel: 'Cancel'
      },
      () => resolve(true),
      () => resolve(false)
    )
  )
}
