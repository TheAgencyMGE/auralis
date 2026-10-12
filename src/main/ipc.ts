// The single IPC entry point. Every call is attributed to a role by the
// identity of the sending webContents *and* its committed origin, checked
// against the role's (and page's) allowlist, and its arguments validated.
import { app, dialog, ipcMain, session, shell, type IpcMainInvokeEvent } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { BrowserWin } from './window'
import type { Tab } from './tab'
import { clampZoom } from './tab'
import { ctx, settings } from './context'
import { IPC_CALL, PAGE_METHODS, ROLE_METHODS, type Role } from '../shared/ipc'
import { INTERNAL_PAGES, SCHEME, resolveInput, type InternalPage } from '../shared/url'
import type { Rect } from '../shared/types'
import { accept, omniboxDismiss, omniboxInput, omniboxMove } from './omnibox'
import * as menus from './menus'
import { runCommand } from './commands'
import { clearFinishedDownloads, downloadAction, listDownloads } from './downloads'
import { currencyRates, fetchFeed, getArticle, geocode, meter, processRows, thumbsFor, topSites, weather } from './tools'
import { allowHttpFor, shieldStats } from './shield'
import { allowUnsafeHost, safetyStats } from './safety'
import * as extensions from './extensions'
import { importWallpapers, removeWallpaper } from './wallpapers'
import { parseChromiumJson, parseNetscapeHtml, BAR_ID } from './data/bookmarks'
import { logger, logFilePath } from './log'

const log = logger('ipc')

class Invalid extends Error {}

// ---- validators ---------------------------------------------------------------

const str = (v: unknown, max = 4096): string => {
  if (typeof v !== 'string' || v.length > max) throw new Invalid('string expected')
  return v
}
const int = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new Invalid('integer expected')
  return v
}
const num = (v: unknown, min = -1e7, max = 1e7): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Invalid('number expected')
  return v
}
const oneOf = <T extends string>(v: unknown, opts: readonly T[]): T => {
  if (!opts.includes(v as T)) throw new Invalid(`one of ${opts.join(', ')} expected`)
  return v as T
}
const rect = (v: unknown): Rect => {
  if (!v || typeof v !== 'object') throw new Invalid('rect expected')
  const r = v as Record<string, unknown>
  return { x: num(r.x), y: num(r.y), width: num(r.width, 0), height: num(r.height, 0) }
}
const optRect = (v: unknown): Rect | undefined => (v == null ? undefined : rect(v))
const obj = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Invalid('object expected')
  return v as Record<string, unknown>
}

// ---- sender identification ----------------------------------------------------

interface Caller {
  role: Role
  win: BrowserWin | null
  page?: InternalPage
  tab?: Tab
}

function identify(e: IpcMainInvokeEvent): Caller | null {
  const frame = e.senderFrame
  // Only top-level documents speak IPC; subframes never get the bridge.
  if (!frame || frame !== e.sender.mainFrame) return null
  let url: URL
  try {
    url = new URL(frame.url)
  } catch {
    return null
  }
  if (url.protocol !== `${SCHEME}:`) return null
  for (const win of BrowserWin.all.values()) {
    if (url.hostname === 'chrome' && win.chrome === e.sender) return { role: 'chrome', win }
    if (url.hostname === 'overlay' && win.overlay.view.webContents === e.sender) return { role: 'overlay', win }
    if ((INTERNAL_PAGES as readonly string[]).includes(url.hostname)) {
      const tab = win.tabs.find((t) => t.wc === e.sender)
      if (tab) return { role: 'page', win, page: url.hostname as InternalPage, tab }
    }
  }
  return null
}

// ---- handlers -------------------------------------------------------------------

type Handler = (c: Caller, ...args: unknown[]) => unknown

const needWin = (c: Caller): BrowserWin => {
  if (!c.win) throw new Invalid('no window')
  return c.win
}
const tabArg = (c: Caller, id: unknown): Tab => {
  const t = needWin(c).tabById(int(id))
  if (!t) throw new Invalid('no such tab')
  return t
}

/** Settings each non-settings caller may change: only its own presentation. */
const SETTABLE: Record<string, readonly string[]> = {
  chrome: ['widgets', 'notes', 'weatherLocation', 'temperatureUnit', 'sidebar', 'newsFeed', 'currencyBase', 'currencyQuotes', 'sidebarCompact'],
  newtab: ['widgets', 'notes', 'wallpaper', 'weatherLocation', 'temperatureUnit', 'aeroSounds', 'newsFeed', 'currencyBase', 'currencyQuotes'],
  welcome: ['searchEngine', 'frameColor', 'wallpaper', 'transparency', 'startupSound', 'splash', 'welcomed', 'showBookmarksBar', 'uiStyle'],
  feed: ['newsFeed', 'widgets']
}

const handlers: Record<string, Handler> = {
  // chrome lifecycle & layout
  'chrome.ready': (c) => {
    const w = needWin(c)
    w.markChromeReady()
    return { settings: settings.get(), state: w.state() }
  },
  'window.layout': (c, viewport, anchors) => {
    const a = anchors && typeof anchors === 'object' ? (anchors as Record<string, unknown>) : {}
    needWin(c).setViewport(rect(viewport), {
      siteInfo: optRect(a.siteInfo),
      omnibox: optRect(a.omnibox),
      menu: optRect(a.menu),
      downloads: optRect(a.downloads),
      star: optRect(a.star)
    })
  },
  'window.minimize': (c) => needWin(c).win.minimize(),
  'window.toggleMaximize': (c) => {
    const w = needWin(c).win
    if (w.isFullScreen()) w.setFullScreen(false)
    else if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  },
  'window.close': (c) => needWin(c).win.close(),
  'window.systemMenu': (c, at) => {
    const w = needWin(c)
    const r = rect(at)
    menus.showChromeMenu(w, r)
  },

  // tabs
  'tab.new': (c, opts) => {
    const o = opts ? obj(opts) : {}
    const w = needWin(c)
    w.createTab({ url: o.url != null ? resolveInput(str(o.url), settings.get().searchEngine).url : undefined }, { activate: o.background !== true, index: o.index != null ? int(o.index) : undefined })
  },
  'tab.close': (c, id) => needWin(c).closeTab(tabArg(c, id)),
  'tab.activate': (c, id) => needWin(c).activate(tabArg(c, id)),
  'tab.move': (c, id, index) => needWin(c).moveTab(tabArg(c, id), int(index)),
  'tab.detach': (c, id, at) => {
    const w = needWin(c)
    const tab = tabArg(c, id)
    const p = obj(at)
    const point = { x: Math.round(num(p.x)), y: Math.round(num(p.y)) }
    // Dropped on another window of the same kind: join it. Otherwise: a new window.
    const target = [...BrowserWin.all.values()].find((o) => {
      if (o === w || o.incognito !== w.incognito || o.win.isMinimized()) return false
      const b = o.win.getBounds()
      return point.x >= b.x && point.x < b.x + b.width && point.y >= b.y && point.y < b.y + b.height
    })
    if (!target && w.tabs.filter((t) => !t.closing).length === 1) return
    w.moveTabToWindow(tab, target ?? null, target ? undefined : point)
  },
  'tab.menu': (c, id, anchor) => menus.showTabMenu(needWin(c), tabArg(c, id), rect(anchor)),
  'tab.toggleMute': (c, id) => {
    const t = tabArg(c, id)
    t.setMuted(!t.muted)
  },
  'tab.preview': async (c, id, anchor) => {
    const w = needWin(c)
    if (id == null) {
      if (w.overlay.isOpen('preview')) w.overlay.hide()
      return
    }
    if (!settings.get().tabPreviews || (w.overlay.isOpen() && !w.overlay.isOpen('preview'))) return
    const t = tabArg(c, id)
    const r = rect(anchor)
    if (t === w.activeTab) await t.captureThumbnail()
    w.showOverlay({
      content: { kind: 'preview', tab: { id: t.id, title: t.title || t.displayUrl(), url: t.displayUrl(), favicon: t.favicon, thumbnail: t.previewImage(), asleep: !t.wc, active: t === w.activeTab, spaceId: t.spaceId } },
      anchor: r,
      align: 'start',
      passive: true
    })
  },

  // navigation
  'nav.go': (c, input, disposition) => {
    const w = needWin(c)
    const d = disposition == null ? 'current' : oneOf(disposition, ['current', 'newtab', 'background'] as const)
    const text = str(input, 8192)
    if (c.role === 'page') {
      // Internal pages may only open web or internal URLs, never script schemes.
      const url = resolveInput(text, settings.get().searchEngine).url
      if (d === 'current' && c.tab) c.tab.navigate(url)
      else w.createTab({ url, openerId: c.tab?.id ?? null }, { activate: d !== 'background', afterOpener: true })
      return
    }
    accept(w, text, null, d === 'current' ? 'current' : 'newtab')
  },
  'nav.back': (c) => needWin(c).activeTab?.wc?.navigationHistory.goBack(),
  'nav.forward': (c) => needWin(c).activeTab?.wc?.navigationHistory.goForward(),
  'nav.reload': (c, hard) => needWin(c).activeTab?.reload(hard === true),
  'nav.stop': (c) => needWin(c).activeTab?.wc?.stop(),
  'nav.home': (c) => needWin(c).activeTab?.navigate(settings.get().homePage),
  'nav.historyMenu': (c, dir, anchor) => menus.showHistoryMenu(needWin(c), oneOf(dir, ['back', 'forward'] as const), rect(anchor)),

  // omnibox
  'omnibox.input': (c, text, anchor, allowInline) => omniboxInput(needWin(c), str(text, 2048), rect(anchor), allowInline === true),
  'omnibox.move': (c, delta) => omniboxMove(needWin(c), num(delta, -20, 20)),
  'omnibox.accept': (c, text, index, newTab) => accept(needWin(c), str(text, 8192), index == null ? null : int(index), newTab === true ? 'newtab' : 'current'),
  'omnibox.dismiss': (c) => {
    const w = needWin(c)
    setTimeout(() => {
      if (!w.overlay.view.webContents.isFocused()) omniboxDismiss(w)
    }, 150)
  },

  // popovers
  'menu.app': (c, anchor) => menus.showAppMenu(needWin(c), rect(anchor)),
  'menu.spaces': (c, anchor) => menus.showSpaces(needWin(c), rect(anchor)),
  'menu.downloads': (c, anchor) => menus.showDownloads(needWin(c), rect(anchor)),
  'menu.siteinfo': (c, anchor) => menus.showSiteInfo(needWin(c), rect(anchor)),
  'menu.zoom': (c, anchor) => {
    const w = needWin(c)
    const show = () => {
      const level = Math.round((w.activeTab?.wc?.getZoomFactor() ?? 1) * 100)
      w.showOverlay({ content: { kind: 'zoom', level }, anchor: rect(anchor), align: 'end' }, (id) => {
        if (id === 'in' || id === 'out' || id === 'reset') {
          runCommand(w, id === 'in' ? 'zoom-in' : id === 'out' ? 'zoom-out' : 'zoom-reset')
          show()
        }
      })
    }
    show()
  },
  'menu.bookmarkStar': (c, anchor) => menus.bookmarkCurrent(needWin(c), rect(anchor)),
  'menu.bookmarkFolder': (c, id, anchor) => menus.showBookmarkFolder(needWin(c), int(id), rect(anchor)),
  'menu.bookmarkItem': (c, id, anchor) => menus.showBookmarkItemMenu(needWin(c), int(id), rect(anchor)),
  'menu.chrome': (c, anchor) => menus.showChromeMenu(needWin(c), rect(anchor)),
  'bookmark.open': (c, id, disposition) => {
    const n = ctx.bookmarks.get(int(id))
    if (n?.url) menus.openBookmark(needWin(c), n.url, oneOf(disposition, ['current', 'tab', 'background', 'window', 'private'] as const))
  },
  'bookmark.move': (c, id, index) => {
    ctx.bookmarks.move(int(id), BAR_ID, int(index))
    needWin(c).pushState()
  },

  // find, zoom, split, spaces, tools
  'find.query': (c, text, forward) => {
    const t = needWin(c).activeTab
    const wc = t?.wc
    if (!t || !wc) return
    const q = str(text, 1000)
    const isNext = q === t.find.text && q !== ''
    t.find = { open: true, text: q, active: q ? t.find.active : 0, matches: q ? t.find.matches : 0 }
    // Electron's `findNext: true` starts a *new* session; follow-ups pass false.
    if (q) wc.findInPage(q, { forward: forward !== false, findNext: !isNext })
    else wc.stopFindInPage('clearSelection')
    needWin(c).pushState()
  },
  'find.close': (c) => {
    const t = needWin(c).activeTab
    if (!t) return
    t.wc?.stopFindInPage('keepSelection')
    t.find = { open: false, text: t.find.text, active: 0, matches: 0 }
    needWin(c).pushState()
    t.wc?.focus()
  },
  'zoom.adjust': (c, delta) => {
    const t = needWin(c).activeTab
    const wc = t?.wc
    if (!wc) return
    const d = num(delta, -1, 1)
    wc.setZoomFactor(d === 0 ? settings.get().defaultZoom : clampZoom(wc.getZoomFactor() + d))
    needWin(c).pushState()
  },
  'split.setRatio': (c, r) => needWin(c).setSplitRatio(num(r, 0, 1)),
  'split.close': (c) => needWin(c).closeSplit(),
  'split.swap': (c) => needWin(c).swapSplit(),
  'space.switch': (c, id) => needWin(c).switchSpace(str(id, 64)),
  'tool.run': (c, id) => runCommand(needWin(c), str(id, 64)),
  'status.dismiss': () => undefined,
  'extensions.activate': (c, id, anchor) => extensions.activateAction(needWin(c), str(id, 64), rect(anchor)),
  'extensions.menu': (c, id, anchor) => extensions.actionMenu(needWin(c), str(id, 64), rect(anchor)),
  'extensions.list': () => extensions.listExtensions(),
  'extensions.remove': (c, id) => extensions.removeExtension(str(id, 64), needWin(c)).then((ok) => (ok && notifyExtensionPages(), ok)),
  'extensions.options': (c, id) => extensions.openOptions(needWin(c), str(id, 64)),
  'extensions.loadUnpacked': async (c) => {
    const r = await extensions.loadUnpacked(needWin(c))
    notifyExtensionPages()
    return r
  },
  'extensions.update': () => extensions.updateAll(),
  'wallpaper.import': (c) => importWallpapers(needWin(c)),
  'wallpaper.remove': (_c, id) => removeWallpaper(str(id, 32)),
  'media.control': (c, id, action) => void tabArg(c, id).mediaControl(oneOf(action, ['toggle', 'back', 'forward'] as const)),
  'infobar.action': (c, id, action) => needWin(c).infobarAction(str(id, 100), oneOf(action, ['once', 'always', 'open', 'show', 'dismiss'] as const)),
  'feed.open': (c, url) => {
    const u = str(url, 2048)
    if (!/^https?:\/\//i.test(u)) throw new Invalid('web feed expected')
    needWin(c).activeTab?.navigate(`${SCHEME}://feed/?url=${encodeURIComponent(u)}`)
  },

  // overlay
  'overlay.measured': (c, token, size) => {
    const s = obj(size)
    needWin(c).overlay.measured(int(token), { width: num(s.width, 0, 10000), height: num(s.height, 0, 10000) })
  },
  'overlay.action': (c, id, payload) => {
    // Payloads are small JSON values; each action handler re-validates its own.
    const json = JSON.stringify(payload ?? null)
    if (json.length > 10_000) throw new Invalid('payload too large')
    needWin(c).overlay.action(str(id, 200), payload)
  },
  'overlay.close': (c) => needWin(c).overlay.hide(),
  'palette.query': (c, q) => menus.paletteResults(needWin(c), str(q, 200)),
  'flip.query': (c) => thumbsFor(needWin(c), true),

  // settings
  'settings.get': () => settings.get(),
  'settings.set': (c, patch) => {
    const p = obj(patch)
    const who = c.role === 'chrome' ? 'chrome' : c.role === 'page' ? c.page! : null
    const allowed = who ? SETTABLE[who] : undefined
    if (allowed) for (const k of Object.keys(p)) if (!allowed.includes(k)) throw new Invalid(`${who} may not set ${k}`)
    return settings.set(p)
  },

  // new tab page
  'ntp.info': (c) => ({ incognito: !!c.win?.incognito }),
  'ntp.topSites': (c) => (settings.get().widgets.topSites && !c.win?.incognito ? topSites(8) : []),
  'ntp.removeTopSite': (_c, host) => ctx.history.hideTopSite(str(host, 300).replace(/^www\./, '')),
  'weather.get': () => weather(),
  'geo.search': (_c, q) => geocode(str(q, 100)),
  'meter.get': () => meter([...BrowserWin.all.values()]),
  'feed.get': (c, url) => fetchFeed(c.win?.session ?? session.defaultSession, str(url, 2048)),
  'currency.get': () => {
    const s = settings.get()
    return s.currencyQuotes.length ? currencyRates(s.currencyBase, s.currencyQuotes.filter((q) => q !== s.currencyBase)) : { rates: {} }
  },

  // history
  'history.search': (c, q, before) => {
    if (c.win?.incognito) return []
    return ctx.history.search(str(q, 300), 150, before == null ? undefined : num(before, 0, 9e15)).map((h) => ({ ...h, favicon: ctx.favicons.get(hostOfUrl(h.url))?.data ?? null }))
  },
  'history.remove': (_c, urls) => {
    if (!Array.isArray(urls) || urls.length > 5000) throw new Invalid('array expected')
    ctx.history.remove(urls.map((u) => str(u, 8192)))
  },
  'history.clear': (_c, since) => {
    if (since == null) ctx.history.clear()
    else ctx.history.removeSince(num(since, 0, 9e15))
  },

  // favorites
  'bookmarks.tree': () => ({ tree: ctx.bookmarks.tree(), icons: Object.fromEntries([...ctx.bookmarks.urlSet()].map((u) => [u, ctx.favicons.get(hostOfUrl(u))?.data ?? null])) }),
  'bookmarks.create': (_c, input) => {
    const o = obj(input)
    const node = ctx.bookmarks.create({
      parentId: int(o.parentId),
      kind: oneOf(o.kind, ['folder', 'url'] as const),
      title: str(o.title ?? '', 1024),
      url: o.url == null ? null : str(o.url, 8192),
      index: o.index == null ? undefined : int(o.index)
    })
    refreshBookmarks()
    return node
  },
  'bookmarks.update': (_c, id, patch) => {
    const p = obj(patch)
    ctx.bookmarks.update(int(id), { title: p.title == null ? undefined : str(p.title, 1024), url: p.url == null ? undefined : str(p.url, 8192) })
    refreshBookmarks()
  },
  'bookmarks.move': (_c, id, parentId, index) => {
    ctx.bookmarks.move(int(id), int(parentId), int(index))
    refreshBookmarks()
  },
  'bookmarks.remove': (_c, id) => {
    ctx.bookmarks.remove(int(id))
    refreshBookmarks()
  },
  'bookmarks.import': async (c, source) => {
    const src = oneOf(source, ['html', 'chrome', 'edge', 'brave'] as const)
    let nodes
    let label
    if (src === 'html') {
      const r = await dialog.showOpenDialog(needWin(c).win, { properties: ['openFile'], filters: [{ name: 'Bookmarks file', extensions: ['html', 'htm'] }] })
      if (r.canceled || !r.filePaths[0]) return { count: 0, canceled: true }
      const stat = await fs.stat(r.filePaths[0])
      if (stat.size > 50 * 1024 * 1024) throw new Invalid('file too large')
      nodes = parseNetscapeHtml(await fs.readFile(r.filePaths[0], 'utf8'))
      label = `Imported ${new Date().toLocaleDateString()}`
    } else {
      const base = process.env.LOCALAPPDATA ?? ''
      const dir = { chrome: 'Google/Chrome', edge: 'Microsoft/Edge', brave: 'BraveSoftware/Brave-Browser' }[src]
      const file = path.join(base, dir, 'User Data', 'Default', 'Bookmarks')
      try {
        nodes = parseChromiumJson(await fs.readFile(file, 'utf8'))
      } catch {
        return { count: 0, notFound: true }
      }
      label = `From ${src[0].toUpperCase() + src.slice(1)}`
    }
    const count = ctx.bookmarks.importTree(label, nodes)
    refreshBookmarks()
    return { count }
  },
  'bookmarks.export': async (c) => {
    const r = await dialog.showSaveDialog(needWin(c).win, {
      defaultPath: path.join(app.getPath('documents'), `auralis-favorites-${new Date().toISOString().slice(0, 10)}.html`),
      filters: [{ name: 'Bookmarks file', extensions: ['html'] }]
    })
    if (r.canceled || !r.filePath) return { saved: false }
    await fs.writeFile(r.filePath, ctx.bookmarks.exportHtml(), 'utf8')
    return { saved: true, path: r.filePath }
  },

  // downloads
  'downloads.list': () => listDownloads(),
  'downloads.action': (_c, id, action) => downloadAction(str(id, 64), oneOf(action, ['open', 'show', 'pause', 'resume', 'cancel', 'remove', 'retry'] as const)),
  'downloads.clear': () => clearFinishedDownloads(),

  // task manager
  'tasks.list': () => processRows([...BrowserWin.all.values()]),
  'tasks.action': (_c, tabId, action) => {
    const a = oneOf(action, ['end', 'sleep', 'wake', 'focus'] as const)
    for (const w of BrowserWin.all.values()) {
      const t = w.tabById(int(tabId))
      if (!t) continue
      if (a === 'end') w.closeTab(t)
      else if (a === 'sleep' && t !== w.activeTab) t.sleep()
      else if (a === 'wake') t.wake()
      else if (a === 'focus') {
        w.win.focus()
        w.activate(t)
      }
    }
  },

  // reader & error pages
  'reader.get': (_c, id) => getArticle(str(id, 32)),
  'error.info': (c) => {
    const t = c.tab
    if (!t?.error) return null
    return { ...t.error, crashed: t.crashed }
  },
  'error.action': (c, action) => {
    const t = c.tab
    if (!t?.error) return
    const a = oneOf(action, ['retry', 'http', 'back', 'unsafe-continue'] as const)
    if (a === 'unsafe-continue' && t.error.type === 'unsafe') {
      const url = t.error.url
      try {
        allowUnsafeHost(new URL(url).hostname)
      } catch {
        return
      }
      t.error = null
      t.navigate(url)
      return
    }
    if (a === 'http' && t.error.type === 'https') {
      const url = t.error.url
      try {
        allowHttpFor(new URL(url).hostname)
      } catch {
        return
      }
      t.error = null
      t.navigate(url)
    } else if (a === 'back') {
      const wc = t.wc
      if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
      else t.navigate(settings.get().homePage)
    } else t.reload()
  },

  // privacy & site data
  'data.clear': async (c, opts) => {
    const o = obj(opts)
    const since = o.since == null ? 0 : num(o.since, 0, 9e15)
    const what = obj(o.what)
    const ses = c.win?.incognito ? c.win.session : session.defaultSession
    if (what.history === true) since ? ctx.history.removeSince(since) : ctx.history.clear()
    if (what.downloads === true) clearFinishedDownloads()
    if (what.cookies === true) await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'filesystem', 'shadercache'] })
    if (what.cache === true) {
      await ses.clearCache()
      await ses.clearCodeCaches({})
    }
    if (what.permissions === true) ctx.permissions.clear()
    if (what.favicons === true) ctx.favicons.clear()
    log.info('cleared data', Object.keys(what).filter((k) => what[k] === true))
    return true
  },
  'permissions.list': () => ctx.permissions.all(),
  'permissions.remove': (_c, origin, permission) => ctx.permissions.remove(str(origin, 2048), permission == null ? undefined : str(permission, 64)),
  'shield.stats': () => ({ ...shieldStats(), safety: safetyStats() }),
  'dialog.chooseFolder': async (c) => {
    const r = await dialog.showOpenDialog(needWin(c).win, { properties: ['openDirectory', 'createDirectory'], defaultPath: settings.get().downloadDir })
    if (r.canceled || !r.filePaths[0]) return null
    settings.set({ downloadDir: r.filePaths[0] })
    return r.filePaths[0]
  },
  'app.info': () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    v8: process.versions.v8,
    platform: `${process.platform} ${process.getSystemVersion()}`,
    userData: app.getPath('userData'),
    log: logFilePath(),
    packaged: app.isPackaged
  }),
  'app.licenses': async () => {
    const file = path.join(app.getAppPath(), 'THIRD_PARTY_NOTICES.md')
    try {
      return await fs.readFile(file, 'utf8')
    } catch {
      return 'Third-party notices are included with the installer.'
    }
  },
  'app.defaultBrowser': async () => {
    // Windows only lets the user choose; this opens Auralis' entry in Default apps.
    await shell.openExternal('ms-settings:defaultapps?registeredAppUser=Auralis')
    return app.isPackaged
  },
  'app.relaunch': () => {
    app.relaunch()
    app.quit()
  }
}

function hostOfUrl(u: string): string {
  try {
    return new URL(u).hostname
  } catch {
    return ''
  }
}

/** Extension pages refresh their list when something was added or removed. */
function notifyExtensionPages(): void {
  for (const w of BrowserWin.all.values())
    for (const t of w.tabs) if (t.wc?.getURL().startsWith(`${SCHEME}://extensions`)) t.wc.send('auralis:event', 'extensions', null)
}

function refreshBookmarks(): void {
  for (const w of BrowserWin.all.values()) w.pushState()
}

export function installIpc(): void {
  ipcMain.handle(IPC_CALL, async (e, method: unknown, ...args: unknown[]) => {
    if (typeof method !== 'string') throw new Error('Bad request')
    const caller = identify(e)
    if (!caller) {
      log.warn('rejected IPC from unknown sender', e.senderFrame?.url, method)
      throw new Error('Unauthorized')
    }
    if (!ROLE_METHODS[caller.role].includes(method)) throw new Error(`Not allowed: ${method}`)
    if (caller.role === 'page' && !(PAGE_METHODS[caller.page!] as readonly string[]).includes(method)) {
      log.warn(`page ${caller.page} attempted ${method}`)
      throw new Error(`Not allowed: ${method}`)
    }
    const fn = handlers[method]
    if (!fn) throw new Error(`Unknown method: ${method}`)
    try {
      return await fn(caller, ...args)
    } catch (err) {
      if (err instanceof Invalid) {
        log.warn(`invalid ${method}:`, err.message)
        throw new Error(`Invalid arguments for ${method}`)
      }
      log.error(`${method} failed`, err)
      throw new Error(`${method} failed`)
    }
  })
}
