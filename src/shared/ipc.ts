// The complete IPC surface. Renderers can only call methods listed here,
// and the main process re-checks the caller's role (and, for internal pages,
// the page) on every call. Payloads are validated in src/main/ipc.ts.

import type { InternalPage } from './url'

export const IPC_CALL = 'auralis:call'
export const IPC_EVENT = 'auralis:event'

export type Role = 'chrome' | 'overlay' | 'page'

const CHROME = [
  'chrome.ready',
  'tab.new',
  'tab.close',
  'tab.activate',
  'tab.move',
  'tab.detach',
  'tab.menu',
  'tab.preview',
  'tab.toggleMute',
  'nav.go',
  'nav.back',
  'nav.forward',
  'nav.reload',
  'nav.stop',
  'nav.home',
  'nav.historyMenu',
  'window.minimize',
  'window.toggleMaximize',
  'window.close',
  'window.layout',
  'window.systemMenu',
  'omnibox.input',
  'omnibox.move',
  'omnibox.accept',
  'omnibox.dismiss',
  'menu.app',
  'menu.spaces',
  'menu.downloads',
  'menu.siteinfo',
  'menu.zoom',
  'menu.bookmarkStar',
  'menu.bookmarkFolder',
  'menu.bookmarkItem',
  'menu.chrome',
  'bookmark.open',
  'bookmark.move',
  'find.query',
  'find.close',
  'zoom.adjust',
  'split.setRatio',
  'split.close',
  'split.swap',
  'space.switch',
  'tool.run',
  'settings.get',
  'status.dismiss'
] as const

const OVERLAY = [
  'overlay.measured',
  'overlay.action',
  'overlay.close',
  'palette.query',
  'flip.query',
  'settings.get'
] as const

const PAGE = [
  'settings.get',
  'settings.set',
  'nav.go',
  'ntp.info',
  'ntp.topSites',
  'ntp.removeTopSite',
  'weather.get',
  'geo.search',
  'meter.get',
  'history.search',
  'history.remove',
  'history.clear',
  'bookmarks.tree',
  'bookmarks.create',
  'bookmarks.update',
  'bookmarks.move',
  'bookmarks.remove',
  'bookmarks.import',
  'bookmarks.export',
  'downloads.list',
  'downloads.action',
  'downloads.clear',
  'tasks.list',
  'tasks.action',
  'reader.get',
  'error.info',
  'error.action',
  'data.clear',
  'permissions.list',
  'permissions.remove',
  'shield.stats',
  'dialog.chooseFolder',
  'app.info',
  'app.licenses',
  'app.relaunch',
  'app.defaultBrowser'
] as const

export type ChromeMethod = (typeof CHROME)[number]
export type OverlayMethod = (typeof OVERLAY)[number]
export type PageMethod = (typeof PAGE)[number]
export type Method = ChromeMethod | OverlayMethod | PageMethod

export const ROLE_METHODS: Record<Role, readonly string[]> = {
  chrome: CHROME,
  overlay: OVERLAY,
  page: PAGE
}

/** Which internal page may call which page methods. Least privilege: the new
 *  tab page cannot clear history, the history page cannot change settings. */
export const PAGE_METHODS: Record<InternalPage, readonly PageMethod[]> = {
  newtab: ['settings.get', 'settings.set', 'nav.go', 'ntp.info', 'ntp.topSites', 'ntp.removeTopSite', 'weather.get', 'geo.search', 'meter.get'],
  settings: [
    'settings.get', 'settings.set', 'nav.go', 'data.clear', 'permissions.list', 'permissions.remove', 'shield.stats',
    'dialog.chooseFolder', 'bookmarks.import', 'bookmarks.export', 'app.info', 'geo.search', 'app.relaunch', 'app.defaultBrowser'
  ],
  history: ['settings.get', 'nav.go', 'history.search', 'history.remove', 'history.clear'],
  bookmarks: [
    'settings.get', 'nav.go', 'bookmarks.tree', 'bookmarks.create', 'bookmarks.update', 'bookmarks.move', 'bookmarks.remove',
    'bookmarks.import', 'bookmarks.export'
  ],
  downloads: ['settings.get', 'nav.go', 'downloads.list', 'downloads.action', 'downloads.clear'],
  taskmanager: ['settings.get', 'tasks.list', 'tasks.action'],
  reader: ['settings.get', 'nav.go', 'reader.get'],
  error: ['settings.get', 'nav.go', 'error.info', 'error.action'],
  about: ['settings.get', 'nav.go', 'app.info', 'app.licenses']
}

export const EVENTS = [
  'state',
  'settings',
  'overlay',
  'omnibox.fill',
  'omnibox.focus',
  'find.focus',
  'downloads',
  'history',
  'bookmarks',
  'tasks',
  'flip.results',
  'palette.results'
] as const
export type EventName = (typeof EVENTS)[number]

export interface AuralisBridge {
  call<T = unknown>(method: Method, ...args: unknown[]): Promise<T>
  on(event: EventName, cb: (payload: unknown) => void): () => void
  platform: string
}
