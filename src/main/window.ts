// A browser window: the chrome (this BrowserWindow's own webContents), the
// tab views placed inside the rectangle the chrome reserves for them, and
// the overlay on top. Spaces, split view and the closed-tab stack live here.
import { BrowserWindow, app, session, type Session, type WebContents, type NavigationEntry } from 'electron'
import path from 'node:path'
import { Tab, type TabInit, type TabHost } from './tab'
import { Overlay } from './overlay'
import { ctx, settings } from './context'
import { setupWebSession } from './web-session'
import { installProtocol, uiUrl } from './protocol'
import { IPC_EVENT, type EventName } from '../shared/ipc'
import { FRAME_COLORS } from '../shared/settings'
import { NEW_TAB_URL, SCHEME, internalPage } from '../shared/url'
import type { MenuItem, OverlayContent, OverlayRequest, Rect, Space, SpaceColor, SplitState, WindowState } from '../shared/types'
import { logger } from './log'
import { BAR_ID } from './data/bookmarks'
import { downloadsSummary } from './downloads'

const log = logger('window')

export interface MenuSpec {
  label?: string
  accelerator?: string
  icon?: string
  checked?: boolean
  disabled?: boolean
  danger?: boolean
  type?: 'separator' | 'header'
  click?: () => void
  submenu?: MenuSpec[]
}

export interface Anchors {
  siteInfo?: Rect
  omnibox?: Rect
  menu?: Rect
  downloads?: Rect
  star?: Rect
}

export interface WindowSnapshot {
  bounds: { x: number; y: number; width: number; height: number }
  maximized: boolean
  spaces: Space[]
  activeSpaceId: string
  activeBySpace: [string, number][]
  tabs: {
    id: number
    spaceId: string
    url: string
    title: string
    pinned: boolean
    muted: boolean
    entries?: NavigationEntry[]
    index?: number
  }[]
}

interface ClosedTab {
  url: string
  title: string
  spaceId: string
  index: number
  entries?: NavigationEntry[]
  entryIndex?: number
}

let uiSession: Session | null = null
function getUiSession(): Session {
  if (!uiSession) {
    uiSession = session.fromPartition('auralis-ui')
    installProtocol(uiSession)
    uiSession.setPermissionRequestHandler((_wc, p, cb) => cb(p === 'clipboard-sanitized-write'))
    uiSession.setPermissionCheckHandler(() => false)
  }
  return uiSession
}

let privateCounter = 0
const SPACE_COLORS: SpaceColor[] = ['sky', 'leaf', 'sun', 'rose', 'violet', 'sea', 'graphite']

export class BrowserWin implements TabHost {
  static readonly all = new Map<number, BrowserWin>()
  static lastFocused: BrowserWin | null = null

  readonly win: BrowserWindow
  readonly session: Session
  readonly incognito: boolean
  readonly overlay: Overlay
  readonly id: number

  tabs: Tab[] = []
  spaces: Space[] = [{ id: 'home', name: 'Home', color: 'sky' }]
  activeSpaceId = 'home'
  private activeBySpace = new Map<string, number>()
  private splitBySpace = new Map<string, SplitState>()
  private attached = new Set<Tab>()
  private capturing = new Set<Tab>()
  private closed: ClosedTab[] = []
  private viewport: Rect = { x: 8, y: 112, width: 800, height: 500 }
  anchors: Anchors = {}
  private status = ''
  private statePending = false
  private htmlFsTab: Tab | null = null
  private popupTimes = new Map<number, number[]>()
  private menuActions = new Map<string, () => void>()
  chromeReady = false
  private onChromeReady: (() => void)[] = []

  constructor(opts: { incognito?: boolean; snapshot?: WindowSnapshot; initialUrls?: string[]; restoreAsleep?: boolean } = {}) {
    this.incognito = !!opts.incognito
    this.session = this.incognito ? session.fromPartition(`auralis-private-${++privateCounter}`) : session.defaultSession
    setupWebSession(this.session, { incognito: this.incognito })

    const s = settings.get()
    const snap = opts.snapshot
    const b = snap?.bounds
    this.win = new BrowserWindow({
      width: b?.width ?? 1280,
      height: b?.height ?? 820,
      x: b?.x,
      y: b?.y,
      minWidth: 560,
      minHeight: 380,
      show: false,
      frame: false,
      title: this.incognito ? 'Auralis — InPrivate' : 'Auralis',
      backgroundColor: s.transparency ? '#00000000' : FRAME_COLORS[s.frameColor].tint,
      backgroundMaterial: s.transparency ? 'acrylic' : 'none',
      roundedCorners: true,
      icon: path.join(app.getAppPath(), 'build', 'icon.ico'),
      webPreferences: {
        session: getUiSession(),
        preload: path.join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        backgroundThrottling: false
      }
    })
    this.id = this.win.id
    BrowserWin.all.set(this.id, this)

    const chrome = this.win.webContents
    chrome.setWindowOpenHandler(() => ({ action: 'deny' }))
    chrome.on('will-navigate', (e) => e.preventDefault())
    chrome.setVisualZoomLevelLimits(1, 1)
    chrome.on('before-input-event', (e, input) => {
      if (handleKey(this, input, 'chrome')) e.preventDefault()
    })
    watchUiConsole(chrome, 'chrome')
    chrome.on('render-process-gone', (_e, d) => {
      log.error('chrome renderer gone', d.reason)
      this.chromeReady = false
      chrome.reload()
    })
    // `ready-to-show` never fires with backgroundMaterial on Windows; reveal on load.
    chrome.once('did-finish-load', () => {
      if (snap?.maximized) this.win.maximize()
      this.win.show()
    })
    void chrome.loadURL(uiUrl('chrome'))

    this.overlay = new Overlay(
      this.win,
      getUiSession(),
      (wc, input) => handleKey(this, input, 'overlay', wc),
      () => this.focusActiveContent()
    )
    this.win.contentView.addChildView(this.overlay.view)

    const push = () => this.pushState()
    this.win.on('maximize', push)
    this.win.on('unmaximize', push)
    this.win.on('enter-full-screen', push)
    this.win.on('leave-full-screen', () => {
      if (this.htmlFsTab) this.htmlFsTab.wc?.executeJavaScript('document.fullscreenElement && document.exitFullscreen()', true).catch(() => {})
      push()
    })
    this.win.on('focus', () => {
      BrowserWin.lastFocused = this
      push()
    })
    this.win.on('blur', () => {
      this.overlay.hide()
      push()
    })
    this.win.on('resize', () => this.overlay.relayout())
    const offSettings = settings.onChange((next, prev) => {
      if (next.transparency !== prev.transparency || next.frameColor !== prev.frameColor) {
        this.win.setBackgroundMaterial(next.transparency ? 'acrylic' : 'none')
        this.win.setBackgroundColor(next.transparency ? '#00000000' : FRAME_COLORS[next.frameColor].tint)
      }
    })
    this.win.once('closed', offSettings)
    this.win.on('close', () => onWindowClosing(this))
    this.win.on('closed', () => {
      if (this.incognito) {
        // Forget everything from this InPrivate window now, not at exit.
        void this.session.clearStorageData().catch(() => {})
        void this.session.clearCache().catch(() => {})
        this.session.flushStorageData()
      }
      BrowserWin.all.delete(this.id)
      if (BrowserWin.lastFocused === this) BrowserWin.lastFocused = null
      for (const t of this.tabs) t.destroyNow()
      this.tabs = []
      onWindowClosed(this)
    })
    BrowserWin.lastFocused = this

    if (snap?.tabs.length) this.restore(snap, opts.restoreAsleep ?? true)
    else {
      const urls = opts.initialUrls?.length ? opts.initialUrls : [NEW_TAB_URL]
      urls.forEach((url, i) => this.createTab({ url, spaceId: this.activeSpaceId }, { activate: i === 0 }))
    }
  }

  get chrome(): WebContents {
    return this.win.webContents
  }

  // ---- tabs --------------------------------------------------------------------

  /** Tabs of the active space, in strip order (pinned first). */
  visibleTabs(spaceId = this.activeSpaceId): Tab[] {
    return this.tabs.filter((t) => t.spaceId === spaceId && !t.closing)
  }

  get activeTab(): Tab | null {
    const id = this.activeBySpace.get(this.activeSpaceId)
    return this.tabs.find((t) => t.id === id && !t.closing) ?? null
  }

  tabById(id: number): Tab | null {
    return this.tabs.find((t) => t.id === id) ?? null
  }

  createTab(init: Omit<TabInit, 'spaceId'> & { spaceId?: string }, opts: { activate?: boolean; index?: number; afterOpener?: boolean } = {}): Tab {
    const tab = new Tab(this, { spaceId: this.activeSpaceId, ...init })
    let index = opts.index ?? this.tabs.length
    if (opts.afterOpener && init.openerId != null) {
      // Chrome-style: links open right after the opener and any of its other children.
      const openerIdx = this.tabs.findIndex((t) => t.id === init.openerId)
      if (openerIdx >= 0) {
        index = openerIdx + 1
        while (index < this.tabs.length && this.tabs[index].openerId === init.openerId) index++
      }
    }
    if (!tab.pinned) {
      const firstUnpinned = this.tabs.findIndex((t) => !t.pinned)
      if (firstUnpinned >= 0) index = Math.max(index, firstUnpinned)
    }
    this.tabs.splice(Math.min(index, this.tabs.length), 0, tab)
    if (opts.activate !== false) this.activate(tab)
    else if (!init.asleep) tab.ensureLoaded()
    this.pushState()
    return tab
  }

  activate(tab: Tab): void {
    if (tab.closing) return
    const prev = this.activeTab
    if (tab.spaceId !== this.activeSpaceId) this.activeSpaceId = tab.spaceId
    this.activeBySpace.set(tab.spaceId, tab.id)
    tab.lastActive = Date.now()
    if (prev) prev.lastActive = Date.now()
    tab.ensureLoaded()
    // Keep a split only while both of its tabs are the ones on screen.
    const split = this.splitBySpace.get(this.activeSpaceId)
    if (split && split.left !== tab.id && split.right !== tab.id) this.splitBySpace.delete(this.activeSpaceId)
    if (prev && prev !== tab && prev.view && !this.capturing.has(prev)) {
      this.capturing.add(prev)
      void prev.captureThumbnail().finally(() => {
        this.capturing.delete(prev)
        this.layout()
      })
    }
    this.overlay.hide()
    this.layout()
    this.focusActiveContent()
    this.pushState()
  }

  focusActiveContent(): void {
    const tab = this.activeTab
    if (!tab?.wc) return
    // A fresh new tab page focuses the omnibox, like every other browser.
    if (tab.wc.getURL().startsWith(NEW_TAB_URL) || (!tab.wc.getURL() && tab.url.startsWith(NEW_TAB_URL))) this.focusOmnibox()
    else tab.wc.focus()
  }

  focusOmnibox(selectAll = true): void {
    this.chrome.focus()
    this.send('omnibox.focus', { selectAll })
  }

  closeTab(tab: Tab): void {
    if (tab.closing) return
    const wasActive = this.activeTab === tab
    const siblings = this.visibleTabs(tab.spaceId)
    const idx = siblings.indexOf(tab)
    if (!this.incognito && !tab.url.startsWith(NEW_TAB_URL)) {
      const wc = tab.wc
      this.closed.push({
        url: tab.displayUrl(),
        title: tab.title,
        spaceId: tab.spaceId,
        index: this.tabs.indexOf(tab),
        entries: wc ? wc.navigationHistory.getAllEntries().map((e) => ({ url: e.url, title: e.title })) : undefined,
        entryIndex: wc ? wc.navigationHistory.getActiveIndex() : undefined
      })
      if (this.closed.length > 25) this.closed.shift()
    }
    tab.close()
    if (wasActive) {
      // Prefer the opener when closing a just-opened child, else the right neighbour.
      const opener = tab.openerId != null ? siblings.find((t) => t.id === tab.openerId && !t.closing) : null
      const next = opener ?? siblings[idx + 1] ?? siblings[idx - 1]
      if (next && next !== tab) this.activate(next)
    }
    this.pushState()
  }

  finalizeClose(tab: Tab): void {
    const i = this.tabs.indexOf(tab)
    if (i < 0) return
    this.tabs.splice(i, 1)
    this.attached.delete(tab)
    if (tab.view) {
      try {
        this.win.contentView.removeChildView(tab.view)
      } catch {
        /* window closing */
      }
    }
    for (const [space, split] of this.splitBySpace) if (split.left === tab.id || split.right === tab.id) this.splitBySpace.delete(space)
    if (this.win.isDestroyed()) return
    if (this.tabs.length === 0) {
      this.win.close()
      return
    }
    if (this.visibleTabs().length === 0) this.createTab({ url: NEW_TAB_URL })
    else if (!this.activeTab) this.activate(this.visibleTabs()[0])
    this.layout()
    this.pushState()
    scheduleSessionSave()
  }

  reopenClosed(): void {
    const c = this.closed.pop()
    if (!c) return
    if (!this.spaces.some((s) => s.id === c.spaceId)) c.spaceId = this.activeSpaceId
    this.createTab(
      { url: c.url, title: c.title, spaceId: c.spaceId, entries: c.entries, index: c.entryIndex, asleep: true },
      { activate: true, index: c.index }
    )
  }

  moveTab(tab: Tab, toVisibleIndex: number): void {
    const visible = this.visibleTabs(tab.spaceId)
    const target = visible.filter((t) => t !== tab)
    const clamped = Math.max(0, Math.min(toVisibleIndex, target.length))
    // Pinned tabs stay together at the front.
    const pinnedCount = target.filter((t) => t.pinned).length
    const finalIdx = tab.pinned ? Math.min(clamped, pinnedCount) : Math.max(clamped, pinnedCount)
    target.splice(finalIdx, 0, tab)
    const others = this.tabs.filter((t) => t.spaceId !== tab.spaceId)
    this.tabs = [...others, ...target]
    this.pushState()
    scheduleSessionSave()
  }

  setPinned(tab: Tab, pinned: boolean): void {
    tab.pinned = pinned
    const visible = this.visibleTabs(tab.spaceId)
    const pinnedCount = visible.filter((t) => t.pinned && t !== tab).length
    this.moveTab(tab, pinned ? pinnedCount : pinnedCount)
  }

  duplicate(tab: Tab): void {
    const wc = tab.wc
    this.createTab(
      {
        url: tab.displayUrl(),
        title: tab.title,
        spaceId: tab.spaceId,
        entries: wc?.navigationHistory.getAllEntries(),
        index: wc?.navigationHistory.getActiveIndex()
      },
      { activate: true, index: this.tabs.indexOf(tab) + 1 }
    )
  }

  closeOthers(tab: Tab): void {
    for (const t of this.visibleTabs(tab.spaceId)) if (t !== tab && !t.pinned) this.closeTab(t)
  }

  closeToRight(tab: Tab): void {
    const v = this.visibleTabs(tab.spaceId)
    for (const t of v.slice(v.indexOf(tab) + 1)) if (!t.pinned) this.closeTab(t)
  }

  /** Move a tab (with its live page) into another window. */
  moveTabToWindow(tab: Tab, target: BrowserWin | null): void {
    const dest = target ?? new BrowserWin({ incognito: this.incognito, initialUrls: [] })
    if (dest.incognito !== this.incognito) return
    const wc = tab.wc
    const entries = wc?.navigationHistory.getAllEntries()
    const index = wc?.navigationHistory.getActiveIndex()
    dest.createTab({ url: tab.displayUrl(), title: tab.title, entries, index, pinned: tab.pinned }, { activate: true })
    // Freshly created windows start with a new tab page; drop it.
    if (!target) for (const t of dest.tabs.slice(0, -1)) dest.closeTab(t)
    this.closeTab(tab)
  }

  // ---- spaces --------------------------------------------------------------------

  switchSpace(id: string): void {
    if (!this.spaces.some((s) => s.id === id) || id === this.activeSpaceId) return
    this.activeSpaceId = id
    const tab = this.activeTab ?? this.visibleTabs()[0]
    if (tab) this.activate(tab)
    else this.createTab({ url: NEW_TAB_URL, spaceId: id })
    this.layout()
    this.pushState()
    scheduleSessionSave()
  }

  createSpace(name?: string): Space {
    const used = new Set(this.spaces.map((s) => s.color))
    const color = SPACE_COLORS.find((c) => !used.has(c)) ?? 'sky'
    const space: Space = { id: `s${Date.now().toString(36)}`, name: name || `Space ${this.spaces.length + 1}`, color }
    this.spaces.push(space)
    this.switchSpace(space.id)
    return space
  }

  updateSpace(id: string, patch: Partial<Pick<Space, 'name' | 'color'>>): void {
    const s = this.spaces.find((x) => x.id === id)
    if (!s) return
    if (patch.name !== undefined) s.name = patch.name.slice(0, 40) || s.name
    if (patch.color && SPACE_COLORS.includes(patch.color)) s.color = patch.color
    this.pushState()
    scheduleSessionSave()
  }

  deleteSpace(id: string): void {
    if (this.spaces.length <= 1) return
    const doomed = this.tabs.filter((t) => t.spaceId === id)
    this.spaces = this.spaces.filter((s) => s.id !== id)
    if (this.activeSpaceId === id) this.switchSpace(this.spaces[0].id)
    for (const t of doomed) t.destroyNow()
    this.tabs = this.tabs.filter((t) => t.spaceId !== id)
    this.activeBySpace.delete(id)
    this.splitBySpace.delete(id)
    this.layout()
    this.pushState()
    scheduleSessionSave()
  }

  moveTabToSpace(tab: Tab, spaceId: string): void {
    if (!this.spaces.some((s) => s.id === spaceId) || tab.spaceId === spaceId) return
    const wasActive = this.activeTab === tab
    const siblings = this.visibleTabs(tab.spaceId)
    tab.spaceId = spaceId
    this.tabs = [...this.tabs.filter((t) => t !== tab), tab]
    if (!this.activeBySpace.has(spaceId)) this.activeBySpace.set(spaceId, tab.id)
    if (wasActive) {
      const next = siblings.find((t) => t !== tab)
      if (next) this.activate(next)
      else this.createTab({ url: NEW_TAB_URL })
    }
    this.layout()
    this.pushState()
  }

  // ---- split view ------------------------------------------------------------------

  get split(): SplitState | null {
    return this.splitBySpace.get(this.activeSpaceId) ?? null
  }

  openSplit(a: Tab, b: Tab): void {
    if (a === b || a.spaceId !== b.spaceId) return
    const focus = b
    // Panes follow strip order: the leftmost tab is on the left.
    const [left, right] = this.tabs.indexOf(a) < this.tabs.indexOf(b) ? [a, b] : [b, a]
    this.splitBySpace.set(left.spaceId, { left: left.id, right: right.id, ratio: 0.5 })
    left.ensureLoaded()
    right.ensureLoaded()
    this.activeBySpace.set(left.spaceId, focus.id)
    this.layout()
    this.pushState()
  }

  /** Split with the tab to the right of the active one, or a new tab. */
  toggleSplit(): void {
    if (this.split) return this.closeSplit()
    const active = this.activeTab
    if (!active) return
    const v = this.visibleTabs()
    const partner = v[v.indexOf(active) + 1] ?? v[v.indexOf(active) - 1] ?? this.createTab({ url: NEW_TAB_URL }, { activate: false })
    this.openSplit(active, partner)
  }

  closeSplit(): void {
    this.splitBySpace.delete(this.activeSpaceId)
    this.layout()
    this.pushState()
  }

  setSplitRatio(r: number): void {
    const s = this.split
    if (!s) return
    s.ratio = Math.min(0.8, Math.max(0.2, r))
    this.layout()
    this.pushState()
  }

  swapSplit(): void {
    const s = this.split
    if (!s) return
    ;[s.left, s.right] = [s.right, s.left]
    this.layout()
    this.pushState()
  }

  // ---- layout ------------------------------------------------------------------------

  setViewport(rect: Rect, anchors: Anchors): void {
    this.viewport = rect
    this.anchors = anchors
    this.layout()
  }

  /** Visible tabs and their rectangles. */
  private placements(): [Tab, Rect][] {
    const active = this.activeTab
    if (!active) return []
    if (this.htmlFsTab && this.htmlFsTab === active) {
      const [w, h] = this.win.getContentSize()
      return [[active, { x: 0, y: 0, width: w, height: h }]]
    }
    const vp = this.viewport
    const split = this.split
    if (split) {
      const l = this.tabById(split.left)
      const r = this.tabById(split.right)
      if (l && r && !l.closing && !r.closing) {
        const gap = 8
        const lw = Math.round((vp.width - gap) * split.ratio)
        return [
          [l, { x: vp.x, y: vp.y, width: lw, height: vp.height }],
          [r, { x: vp.x + lw + gap, y: vp.y, width: vp.width - lw - gap, height: vp.height }]
        ]
      }
    }
    return [[active, vp]]
  }

  layout(): void {
    if (this.win.isDestroyed()) return
    const placements = this.placements()
    const visible = new Set<Tab>()
    for (const [tab, rect] of placements) {
      if (!tab.view || tab.crashed) continue
      visible.add(tab)
      tab.view.setBounds({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height))
      })
      if (!this.attached.has(tab)) {
        this.win.contentView.addChildView(tab.view)
        this.attached.add(tab)
      }
    }
    for (const tab of [...this.attached]) {
      if (visible.has(tab) || this.capturing.has(tab)) continue
      if (tab.view) this.win.contentView.removeChildView(tab.view)
      this.attached.delete(tab)
    }
    // The newest active view must be above a still-capturing previous one.
    const active = this.activeTab
    if (active?.view && this.capturing.size) this.win.contentView.addChildView(active.view)
    this.overlay.raise()
  }

  attachIfVisible(_tab: Tab): void {
    this.layout()
  }

  detachView(tab: Tab): void {
    if (tab.view && this.attached.has(tab)) {
      this.win.contentView.removeChildView(tab.view)
      this.attached.delete(tab)
    }
  }

  // ---- TabHost --------------------------------------------------------------------------

  changed(tab: Tab): void {
    if (tab.spaceId === this.activeSpaceId || tab.audible) this.pushState()
    scheduleSessionSave()
  }

  /** A loading view takes focus; on a new tab page it belongs in the omnibox. */
  newTabPageReady(tab: Tab): void {
    if (tab === this.activeTab && !this.overlay.isOpen() && (this.win.isFocused() || !this.chrome.isFocused())) this.focusOmnibox()
  }

  keyInput(_tab: Tab, input: Electron.Input): boolean {
    return handleKey(this, input, 'tab')
  }

  setStatus(tab: Tab, text: string): void {
    if (tab !== this.activeTab && !this.isInSplit(tab)) return
    if (text === this.status) return
    this.status = text
    this.pushState()
  }

  isInSplit(tab: Tab): boolean {
    const s = this.split
    return !!s && (s.left === tab.id || s.right === tab.id)
  }

  htmlFullscreen(tab: Tab, on: boolean): void {
    this.htmlFsTab = on ? tab : null
    if (on && tab !== this.activeTab) this.activate(tab)
    this.win.setFullScreen(on)
    this.layout()
    this.pushState()
  }

  unresponsive(tab: Tab): void {
    if (tab !== this.activeTab) return
    this.confirm(
      {
        title: `${tab.title || 'This page'} isn’t responding`,
        message: 'You can wait for it to respond, or close the page.',
        confirm: 'Close page',
        cancel: 'Wait'
      },
      () => this.closeTab(tab)
    )
  }

  openFromTab(tab: Tab, details: Electron.HandlerDetails): Electron.WindowOpenHandlerResponse {
    const { url, disposition } = details
    let scheme = ''
    try {
      scheme = new URL(url).protocol
    } catch {
      if (url) return { action: 'deny' }
    }
    if (scheme === `${SCHEME}:`) {
      if (!tab.wc?.getURL().startsWith(`${SCHEME}:`) || !internalPage(url)) return { action: 'deny' }
    } else if (url && !['http:', 'https:', 'about:', 'blob:', 'data:'].includes(scheme)) {
      return { action: 'deny' }
    }
    if (scheme === 'data:' && !/^data:image\//i.test(url)) return { action: 'deny' }

    // Rate-limit scripted popups: more than 3 in 5 seconds is a pop-up storm.
    const now = Date.now()
    const times = (this.popupTimes.get(tab.id) ?? []).filter((t) => now - t < 5000)
    if (times.length >= 3) {
      this.status = 'Pop-up blocked'
      this.pushState()
      log.info('popup blocked from', tab.url)
      return { action: 'deny' }
    }
    times.push(now)
    this.popupTimes.set(tab.id, times)

    const background = disposition === 'background-tab'
    return {
      action: 'allow',
      outlivesOpener: true,
      createWindow: (options) => {
        const t = this.createTab(
          { url: url || 'about:blank', spaceId: tab.spaceId, createOptions: options, openerId: tab.id },
          { activate: !background, afterOpener: true }
        )
        if (!(options as { webContents?: WebContents }).webContents && url) t.navigate(url)
        return t.wc!
      }
    }
  }

  pageContextMenu(tab: Tab, params: Electron.ContextMenuParams): void {
    // Lazy import keeps menus.ts free to import this module.
    void import('./menus').then((m) => m.showPageMenu(this, tab, params))
  }

  // ---- overlay helpers ------------------------------------------------------------------

  showOverlay(req: OverlayRequest, onAction?: (id: string, payload: unknown) => void, onClose?: () => void): void {
    this.overlay.show(req, { onAction, onClose })
  }

  /** Open a menu built from specs; clicks run the matching closure. */
  menu(anchor: Rect, specs: MenuSpec[], align: OverlayRequest['align'] = 'start', minWidth?: number): void {
    this.menuActions.clear()
    let n = 0
    const conv = (s: MenuSpec): MenuItem => {
      const id = s.click ? `m${n++}` : undefined
      if (id && s.click) this.menuActions.set(id, s.click)
      return {
        id,
        label: s.label,
        accelerator: s.accelerator,
        // Favicons travel as data: URLs; the overlay never fetches anything itself.
        icon: s.icon?.startsWith('favicon:') ? (ctx.favicons.get(s.icon.slice(8))?.data ?? 'page') : s.icon,
        checked: s.checked,
        disabled: s.disabled,
        danger: s.danger,
        type: s.type,
        submenu: s.submenu?.map(conv)
      }
    }
    const items = specs.map(conv)
    this.showOverlay({ content: { kind: 'menu', items, minWidth }, anchor, align }, (id) => this.runMenuAction(id))
  }

  runMenuAction(id: string): void {
    const fn = this.menuActions.get(id)
    this.overlay.hide()
    if (fn) setImmediate(fn)
  }

  registerMenuActions(map: Map<string, () => void>): void {
    this.menuActions = map
  }

  confirm(
    text: { title: string; message: string; confirm: string; cancel: string },
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    const token = Math.random().toString(36).slice(2)
    let decided = false
    const [w] = this.win.getContentSize()
    this.showOverlay(
      { content: { kind: 'confirm', ...text, token }, anchor: { x: w / 2, y: this.viewport.y + 24, width: 0, height: 0 }, align: 'center' },
      (id) => {
        decided = true
        this.overlay.hide()
        if (id === 'confirm') onConfirm()
        else onCancel?.()
      },
      () => {
        if (!decided) onCancel?.()
      }
    )
  }

  toast(message: string, icon?: string): void {
    const [w] = this.win.getContentSize()
    const content: OverlayContent = { kind: 'toast', message, icon }
    this.showOverlay({ content, anchor: { x: w / 2, y: this.viewport.y + 16, width: 0, height: 0 }, align: 'center', passive: true })
    setTimeout(() => {
      if (this.overlay.isOpen('toast')) this.overlay.hide()
    }, 2600)
  }

  // ---- state --------------------------------------------------------------------------

  send(name: EventName, payload: unknown): void {
    if (!this.chrome.isDestroyed()) this.chrome.send(IPC_EVENT, name, payload)
  }

  pushState(): void {
    if (this.statePending) return
    this.statePending = true
    setTimeout(() => {
      this.statePending = false
      if (this.win.isDestroyed() || !this.chromeReady) return
      this.send('state', this.state())
    }, 16)
  }

  state(): WindowState {
    const bookmarked = ctx.bookmarks.urlSet()
    const active = this.activeTab
    const counts = downloadsSummary()
    return {
      id: this.id,
      incognito: this.incognito,
      maximized: this.win.isMaximized(),
      fullscreen: this.win.isFullScreen(),
      htmlFullscreen: !!this.htmlFsTab,
      focused: this.win.isFocused(),
      spaces: this.spaces,
      activeSpaceId: this.activeSpaceId,
      tabs: this.visibleTabs().map((t) => t.state(bookmarked)),
      activeTabId: active?.id ?? null,
      split: this.split,
      find: active?.find ?? { open: false, text: '', active: 0, matches: 0 },
      downloads: counts,
      bookmarksBar: ctx.bookmarks.children(BAR_ID).map((n) => ({ ...n, favicon: n.url ? (ctx.favicons.get(hostOfSafe(n.url))?.data ?? null) : null })),
      status: this.status
    }
  }

  whenChromeReady(fn: () => void): void {
    if (this.chromeReady) fn()
    else this.onChromeReady.push(fn)
  }

  markChromeReady(): void {
    this.chromeReady = true
    for (const fn of this.onChromeReady.splice(0)) fn()
    this.pushState()
    this.focusActiveContent()
  }

  // ---- session --------------------------------------------------------------------------

  snapshot(): WindowSnapshot {
    const b = this.win.getNormalBounds()
    return {
      bounds: b,
      maximized: this.win.isMaximized(),
      spaces: this.spaces,
      activeSpaceId: this.activeSpaceId,
      activeBySpace: [...this.activeBySpace],
      tabs: this.tabs
        .filter((t) => !t.closing && !t.displayUrl().startsWith(`${SCHEME}://error`))
        .map((t) => {
          const wc = t.wc
          const entries = wc
            ? wc.navigationHistory
                .getAllEntries()
                .slice(-30)
                .map((e) => ((e.pageState?.length ?? 0) > 32_768 ? { url: e.url, title: e.title } : e))
            : t.snapshotEntries()
          const index = wc ? Math.min(wc.navigationHistory.getActiveIndex(), (entries?.length ?? 1) - 1) : t.snapshotIndex()
          return { id: t.id, spaceId: t.spaceId, url: t.displayUrl(), title: t.title, pinned: t.pinned, muted: t.muted, entries, index }
        })
    }
  }

  private restore(snap: WindowSnapshot, asleep: boolean): void {
    this.spaces = snap.spaces.length ? snap.spaces : this.spaces
    const idMap = new Map<number, Tab>()
    for (const t of snap.tabs) {
      const spaceId = this.spaces.some((s) => s.id === t.spaceId) ? t.spaceId : this.spaces[0].id
      const tab = new Tab(this, {
        spaceId,
        url: t.url,
        title: t.title,
        pinned: t.pinned,
        muted: t.muted,
        entries: t.entries,
        index: t.index,
        asleep: true
      })
      this.tabs.push(tab)
      idMap.set(t.id, tab)
    }
    for (const [space, oldId] of snap.activeBySpace) {
      const tab = idMap.get(oldId)
      if (tab) this.activeBySpace.set(space, tab.id)
    }
    this.activeSpaceId = this.spaces.some((s) => s.id === snap.activeSpaceId) ? snap.activeSpaceId : this.spaces[0].id
    const active = this.activeTab ?? this.visibleTabs()[0]
    if (active) this.activate(active)
    else this.createTab({ url: NEW_TAB_URL })
    if (!asleep) for (const t of this.tabs) t.ensureLoaded()
  }
}

/** Surface errors from Auralis' own renderers in the log. */
export function watchUiConsole(wc: WebContents, name: string): void {
  const ui = logger(`ui:${name}`)
  wc.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') ui[e.level === 'error' ? 'error' : 'warn'](e.message, `${e.sourceId}:${e.lineNumber}`)
  })
  wc.on('did-fail-load', (_e, code, desc, url) => ui.error('failed to load', code, desc, url))
  wc.on('preload-error', (_e, path, err) => ui.error('preload error', path, err))
}

function hostOfSafe(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

// Wired by index.ts to avoid import cycles.
let handleKey: (win: BrowserWin, input: Electron.Input, source: 'chrome' | 'tab' | 'overlay', wc?: WebContents) => boolean = () => false
let onWindowClosing: (win: BrowserWin) => void = () => {}
let onWindowClosed: (win: BrowserWin) => void = () => {}
let scheduleSessionSave: () => void = () => {}
export function wireWindowHooks(hooks: {
  handleKey: typeof handleKey
  onWindowClosing: typeof onWindowClosing
  onWindowClosed: typeof onWindowClosed
  scheduleSessionSave: typeof scheduleSessionSave
}): void {
  handleKey = hooks.handleKey
  onWindowClosing = hooks.onWindowClosing
  onWindowClosed = hooks.onWindowClosed
  scheduleSessionSave = hooks.scheduleSessionSave
}

export const sessionSaveScheduler = () => scheduleSessionSave()
