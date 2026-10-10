// A browser tab. Owns at most one WebContentsView; a sleeping tab owns none
// and keeps just enough state (navigation entries, title, icon, thumbnail)
// to wake up exactly where it was, including back/forward history.
import { WebContentsView, dialog, nativeImage, type BrowserWindowConstructorOptions, type NavigationEntry, type Session, type WebContents } from 'electron'
import path from 'node:path'
import { ctx, settings } from './context'
import { blockedFor, resetBlocked, upgradedFrom, clearUpgrade, isShieldActiveFor } from './shield'
import { certificateFor } from './web-session'
import { clearStopped, stoppedNavigation, type Threat } from './safety'
import { cachedThumb, saveThumb } from './thumbs'
import { logger } from './log'
import { decodeIco, isIco } from './ico'
import { EXTERNAL_SCHEMES, NEW_TAB_URL, SCHEME, WEB_SCHEMES, hostOf, internalPage, securityOf } from '../shared/url'
import type { FeedLink, FindState, MediaState, TabState } from '../shared/types'

const log = logger('tab')
const PAGE_PRELOAD = () => path.join(__dirname, '../preload/index.js')
const MAX_PAGE_STATE = 64 * 1024
/** Input that counts as the user asking for something (and so may open a pop-up). */
const GESTURES = new Set(['mouseDown', 'mouseUp', 'rawKeyDown', 'keyDown', 'gestureTap', 'touchEnd'])
/** Chromium's transient user activation lasts about this long. */
const GESTURE_MS = 5000
/** The Aero "working in background" pointer, only while the page loads. */
const BUSY_CSS = 'html, html * { cursor: progress !important; }'

export interface TabError {
  type: 'network' | 'cert' | 'https' | 'crash' | 'blocked' | 'unsafe'
  url: string
  threat?: Threat
  code: number
  description: string
}

/** What a tab needs from the window that holds it. */
export interface TabHost {
  readonly session: Session
  readonly incognito: boolean
  changed(tab: Tab): void
  attachIfVisible(tab: Tab): void
  detachView(tab: Tab): void
  finalizeClose(tab: Tab): void
  openFromTab(tab: Tab, details: Electron.HandlerDetails): Electron.WindowOpenHandlerResponse
  pageContextMenu(tab: Tab, params: Electron.ContextMenuParams): void
  setStatus(tab: Tab, text: string): void
  unresponsive(tab: Tab): void
  htmlFullscreen(tab: Tab, on: boolean): void
  keyInput(tab: Tab, input: Electron.Input): boolean
  newTabPageReady(tab: Tab): void
  pageFocused(tab: Tab): void
  /** A tab that isn't on screen finished loading (time for its preview picture). */
  backgroundLoaded(tab: Tab): void
}

export interface TabInit {
  spaceId: string
  url?: string
  title?: string
  pinned?: boolean
  muted?: boolean
  asleep?: boolean
  entries?: NavigationEntry[]
  index?: number
  createOptions?: BrowserWindowConstructorOptions
  openerId?: number | null
}

let nextId = 1

export class Tab {
  readonly id = nextId++
  view: WebContentsView | null = null
  spaceId: string
  url: string
  title: string
  favicon: string | null = null
  accent: string | null = null
  pinned: boolean
  muted: boolean
  audible = false
  loading = false
  crashed = false
  closing = false
  lastActive = Date.now()
  thumbnail: string | null = null
  error: TabError | null = null
  find: FindState = { open: false, text: '', active: 0, matches: 0 }
  openerId: number | null
  readerable = false
  feeds: FeedLink[] = []
  media: MediaState | null = null
  /** pop-up URLs blocked on the current page, newest last */
  blockedPopups: string[] = []
  /** when the user last clicked or typed in this page */
  lastGesture = 0
  private busyCss: string | null = null
  /** the page has made sound: silent background videos never get a mini player */
  private heard = false
  private entries: NavigationEntry[] | null
  private entryIndex: number | undefined
  private pendingTyped = false
  /** Whether this view has been given something to load (fresh views report a blank entry). */
  private started = false
  private faviconUrl: string | null = null

  constructor(
    readonly host: TabHost,
    init: TabInit
  ) {
    this.spaceId = init.spaceId
    this.url = init.url ?? NEW_TAB_URL
    this.title = init.title ?? ''
    this.pinned = !!init.pinned
    this.muted = !!init.muted
    this.entries = init.entries?.length ? init.entries : null
    this.entryIndex = init.index
    this.openerId = init.openerId ?? null
    const icon = ctx.favicons.get(hostOf(this.url))
    if (icon) {
      this.favicon = icon.data
      this.accent = icon.accent
    }
    if (!init.asleep || init.createOptions) this.createView(init.createOptions)
  }

  get wc(): WebContents | null {
    return this.view && !this.view.webContents.isDestroyed() ? this.view.webContents : null
  }

  snapshotEntries(): NavigationEntry[] | undefined {
    return this.entries ?? (this.url ? [{ url: this.url, title: this.title }] : undefined)
  }

  snapshotIndex(): number | undefined {
    return this.entries ? this.entryIndex : 0
  }

  get asleep(): boolean {
    return !this.view
  }

  // ---- lifecycle -------------------------------------------------------------

  private createView(createOptions?: BrowserWindowConstructorOptions): void {
    const prefs: Electron.WebPreferences = {
      ...(createOptions?.webPreferences ?? {}),
      session: this.host.session,
      preload: PAGE_PRELOAD(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      safeDialogs: true,
      spellcheck: settings.get().spellcheck,
      backgroundThrottling: true
    }
    // window.open() hands us a pre-created webContents that keeps the opener link.
    const opened = (createOptions as { webContents?: WebContents } | undefined)?.webContents
    const view = new WebContentsView(opened ? { webContents: opened, webPreferences: prefs } : { webPreferences: prefs })
    view.setBackgroundColor('#ffffffff')
    view.setBorderRadius(0)
    this.view = view
    this.started = !!opened
    this.wire(view.webContents)
    view.webContents.setAudioMuted(this.muted)
  }

  /** Load the tab's content into a fresh view (first show, or waking up). */
  ensureLoaded(): void {
    if (!this.view) this.createView()
    const wc = this.wc!
    if (this.started) return
    this.started = true
    const nav = wc.navigationHistory
    if (this.entries?.length) {
      const entries = this.entries
      const index = this.entryIndex
      this.entries = null
      nav.restore({ entries, index }).catch((err) => {
        log.warn('history restore failed, loading url', err)
        void wc.loadURL(this.url).catch(() => {})
      })
    } else {
      void wc.loadURL(this.url).catch(() => {})
    }
  }

  wake(): void {
    if (this.view) return
    this.createView()
    this.ensureLoaded()
    this.host.changed(this)
  }

  /** Discard the renderer, keeping navigation history to restore later. */
  sleep(): void {
    const wc = this.wc
    if (!wc || this.closing) return
    try {
      this.entries = wc.navigationHistory
        .getAllEntries()
        .map((e) => ((e.pageState?.length ?? 0) > MAX_PAGE_STATE ? { url: e.url, title: e.title } : e))
      this.entryIndex = wc.navigationHistory.getActiveIndex()
    } catch {
      this.entries = null
    }
    this.host.detachView(this)
    this.view = null
    resetBlocked(wc.id)
    wc.close()
    this.host.changed(this)
  }

  close(): void {
    if (this.closing) return
    this.closing = true
    const wc = this.wc
    if (!wc) {
      this.host.finalizeClose(this)
      return
    }
    wc.once('destroyed', () => this.host.finalizeClose(this))
    // Give "unsaved changes" pages their beforeunload prompt, but never hang on one.
    wc.close({ waitForBeforeUnload: true })
    setTimeout(() => {
      if (this.closing && !wc.isDestroyed() && !this.unloadPrompted) wc.close()
    }, 2500)
    this.host.changed(this)
  }

  private unloadPrompted = false

  destroyNow(): void {
    this.closing = true
    const wc = this.wc
    if (wc) wc.close()
  }

  // ---- navigation ------------------------------------------------------------

  navigate(url: string, typed = false): void {
    this.error = null
    this.pendingTyped = typed
    if (!this.view) this.createView()
    this.started = true
    void this.wc!.loadURL(url).catch(() => {})
    this.url = url
    this.host.changed(this)
  }

  reload(hard = false): void {
    const wc = this.wc
    if (!wc) return this.wake()
    if (this.crashed) {
      this.crashed = false
      wc.reload()
      this.host.attachIfVisible(this)
      return
    }
    if (this.error && internalPage(wc.getURL()) === 'error') {
      const target = this.error.url
      this.error = null
      void wc.loadURL(target).catch(() => {})
      return
    }
    if (hard) wc.reloadIgnoringCache()
    else wc.reload()
  }

  /** Displayed URL: the failed URL while an error page is showing. */
  displayUrl(): string {
    const current = this.wc?.getURL() || this.url
    if (this.error && internalPage(current) === 'error') return this.error.url
    return current
  }

  state(activeSpaceBookmarks: Set<string>): TabState {
    const wc = this.wc
    const url = this.displayUrl()
    const host = hostOf(url)
    const cert = host ? certificateFor(host) : null
    const certError = this.error?.type === 'cert' || (url.startsWith('https:') && cert !== null && !cert.ok)
    return {
      id: this.id,
      spaceId: this.spaceId,
      url,
      title: this.title || (url.startsWith(NEW_TAB_URL) ? 'New Tab' : url),
      favicon: this.favicon,
      accent: this.accent,
      loading: this.loading,
      canGoBack: wc ? wc.navigationHistory.canGoBack() : (this.entryIndex ?? 0) > 0,
      canGoForward: wc ? wc.navigationHistory.canGoForward() : false,
      pinned: this.pinned,
      muted: this.muted,
      audible: this.audible,
      asleep: !wc,
      crashed: this.crashed,
      security: this.error?.type === 'cert' ? 'error' : securityOf(url, certError),
      zoom: wc ? Math.round(wc.getZoomFactor() * 100) / 100 : 1,
      blocked: wc ? blockedFor(wc.id) : 0,
      shieldActive: isShieldActiveFor(url),
      bookmarked: activeSpaceBookmarks.has(url),
      readerable: this.readerable,
      isNewTab: url.startsWith(NEW_TAB_URL) || url === 'about:blank',
      feeds: this.feeds,
      media: this.heard ? this.media : null,
      popupsBlocked: this.blockedPopups.length
    }
  }

  /** A click or key press a moment ago allows one pop-up, like Chromium's user activation. */
  consumeGesture(): boolean {
    const ok = Date.now() - this.lastGesture < GESTURE_MS
    if (ok) this.lastGesture = 0
    return ok
  }

  /** Mini player buttons: act on the page's playing (or most recent) media element. */
  async mediaControl(action: 'toggle' | 'back' | 'forward'): Promise<void> {
    const wc = this.wc
    if (!wc) return
    const step = action === 'back' ? -10 : action === 'forward' ? 10 : 0
    try {
      await wc.executeJavaScriptInIsolatedWorld(
        997,
        [
          {
            code: `(() => {
              const all = [...document.querySelectorAll('video, audio')];
              const m = all.find((e) => !e.paused) || all.find((e) => e.currentTime > 0) || all[0];
              if (!m) return false;
              if (${step} === 0) { if (m.paused) m.play().catch(() => {}); else m.pause(); }
              else m.currentTime = Math.max(0, Math.min(m.duration || Infinity, m.currentTime + ${step}));
              return true;
            })()`
          }
        ],
        true
      )
    } catch {
      /* navigated away */
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.wc?.setAudioMuted(muted)
    this.host.changed(this)
  }

  /** The best picture of this tab: the latest capture, else the one kept on disk. */
  previewImage(): string | null {
    if (!this.thumbnail && !this.host.incognito) this.thumbnail = cachedThumb(this.displayUrl())
    return this.thumbnail
  }

  async captureThumbnail(): Promise<string | null> {
    const wc = this.wc
    if (!wc || this.crashed || wc.isLoadingMainFrame()) return this.thumbnail
    try {
      const img = await wc.capturePage(undefined, { stayHidden: true })
      if (img.isEmpty()) return this.thumbnail
      const { width } = img.getSize()
      const small = width > 480 ? img.resize({ width: 480, quality: 'good' }) : img
      this.thumbnail = 'data:image/jpeg;base64,' + small.toJPEG(72).toString('base64')
      if (!this.host.incognito) saveThumb(wc.getURL(), this.thumbnail)
    } catch {
      /* page not paintable right now */
    }
    return this.thumbnail
  }

  // ---- events ------------------------------------------------------------------

  private wire(wc: WebContents): void {
    const host = this.host
    wc.setWindowOpenHandler((details) => host.openFromTab(this, details))

    const guard = (e: { preventDefault(): void }, url: string, initiator?: string) => {
      let scheme = ''
      try {
        scheme = new URL(url).protocol
      } catch {
        return e.preventDefault()
      }
      const fromInternal = (initiator ?? wc.getURL()).startsWith(`${SCHEME}:`)
      if (scheme === `${SCHEME}:`) {
        if (!fromInternal || !internalPage(url)) {
          log.warn('blocked navigation to internal page from', initiator ?? wc.getURL())
          e.preventDefault()
        }
        return
      }
      if (scheme === 'file:' && /^https?:/.test(initiator ?? wc.getURL())) return e.preventDefault()
      if (!WEB_SCHEMES.has(scheme) && !EXTERNAL_SCHEMES.has(scheme)) e.preventDefault()
    }
    wc.on('will-navigate', (e) => guard(e, e.url, e.initiator?.url))
    wc.on('will-frame-navigate', (e) => {
      if (!e.isMainFrame && e.url.startsWith(`${SCHEME}:`)) e.preventDefault()
    })
    wc.on('will-redirect', (e) => {
      if (e.url.startsWith(`${SCHEME}:`) || e.url.startsWith('file:')) e.preventDefault()
    })
    wc.on('will-attach-webview', (e) => e.preventDefault())
    wc.on('console-message', (e) => {
      // Only Auralis' own pages are logged; web pages' consoles are their business.
      if ((e.level === 'error' || e.level === 'warning') && wc.getURL().startsWith(`${SCHEME}:`)) log.warn('page console:', e.message, `${e.sourceId}:${e.lineNumber}`)
    })
    wc.on('preload-error', (_e, p, err) => log.error('preload error', p, err))
    wc.on('before-input-event', (e, input) => {
      if (host.keyInput(this, input)) e.preventDefault()
    })
    // The chrome's own document doesn't always see focus leave for a web view.
    wc.on('focus', () => host.pageFocused(this))
    wc.on('input-event', (_e, input) => {
      if (GESTURES.has(input.type)) this.lastGesture = Date.now()
    })
    wc.on('media-started-playing', () => {
      this.media = { title: this.media?.title ?? '', artist: this.media?.artist ?? '', playing: true }
      host.changed(this)
      void this.readMediaMetadata()
    })
    wc.on('media-paused', () => {
      if (!this.media) return
      this.media = { ...this.media, playing: false }
      host.changed(this)
    })
    wc.on('dom-ready', () => {
      if (this.loading && !this.busyCss && settings.get().busyCursor && /^https?:/.test(wc.getURL())) {
        // Author origin: Electron can't remove user-origin sheets again.
        void wc.insertCSS(BUSY_CSS).then((key) => {
          if (this.loading && !wc.isDestroyed()) this.busyCss = key
          else if (!wc.isDestroyed()) void wc.removeInsertedCSS(key).catch(() => {})
        }).catch(() => {})
      }
    })

    wc.on('did-start-loading', () => {
      this.loading = true
      host.changed(this)
    })
    wc.on('did-finish-load', () => {
      if (wc.getURL().startsWith(NEW_TAB_URL)) host.newTabPageReady(this)
    })
    wc.on('did-stop-loading', () => {
      this.loading = false
      if (this.busyCss) {
        void wc.removeInsertedCSS(this.busyCss).catch(() => {})
        this.busyCss = null
      }
      host.changed(this)
      void this.checkReaderable()
      void this.detectFeeds()
      host.backgroundLoaded(this)
    })
    wc.on('did-start-navigation', (e) => {
      if (e.isMainFrame && !e.isSameDocument) {
        this.readerable = false
        this.feeds = []
        this.media = null
        this.heard = false
        this.blockedPopups = []
        if (!e.url.startsWith(`${SCHEME}://error`)) resetBlocked(wc.id)
      }
    })
    wc.on('did-navigate', (_e, url, code) => {
      this.url = url
      this.crashed = false
      if (internalPage(url) !== 'error') {
        this.error = null
        if (code < 400 || code >= 600 || code === 0) clearUpgrade(wc.id)
      }
      this.recordVisit(url)
      this.syncFavicon(url)
      host.changed(this)
    })
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (!isMainFrame) return
      this.url = url
      this.recordVisit(url)
      host.changed(this)
    })
    wc.on('page-title-updated', (_e, title) => {
      this.title = title
      if (!host.incognito) ctx.history.setTitle(wc.getURL(), title)
      host.changed(this)
    })
    wc.on('page-favicon-updated', (_e, favicons) => void this.loadFavicon(favicons))
    wc.on('did-fail-load', (_e, code, description, validatedURL, isMainFrame) => {
      if (!isMainFrame || wc.isDestroyed()) return
      const unsafe = stoppedNavigation(wc.id)
      if (unsafe) {
        clearStopped(wc.id)
        this.error = { type: 'unsafe', url: unsafe.url, code, description, threat: unsafe.threat }
        log.info('dangerous site stopped', unsafe.threat, hostOf(unsafe.url))
        void wc.loadURL(`${SCHEME}://error/?code=unsafe`).catch(() => {})
        return
      }
      if (code === -3) return
      const upgradedHttp = upgradedFrom(wc.id)
      let type: TabError['type'] = code <= -200 && code > -300 ? 'cert' : code === -20 || code === -21 ? 'blocked' : 'network'
      let url = validatedURL
      if (upgradedHttp && validatedURL.startsWith('https:') && (type === 'cert' || code === -102 || code === -105 || code === -106 || code === -118 || code === -101 || code === -100 || code === -107)) {
        type = 'https'
        url = upgradedHttp
      }
      this.error = { type, url, code, description }
      log.info('load failed', code, description, validatedURL)
      void wc.loadURL(`${SCHEME}://error/?code=${code}`).catch(() => {})
    })
    wc.on('certificate-error', (e, _url, _error, _cert, callback) => {
      e.preventDefault()
      callback(false)
    })
    wc.on('render-process-gone', (_e, details) => {
      if (details.reason === 'clean-exit' || this.closing) return
      log.warn('renderer gone', details.reason, this.url)
      this.crashed = true
      this.loading = false
      host.detachView(this)
      host.changed(this)
    })
    wc.on('unresponsive', () => host.unresponsive(this))
    wc.on('update-target-url', (_e, url) => host.setStatus(this, url))
    wc.on('context-menu', (_e, params) => host.pageContextMenu(this, params))
    wc.on('found-in-page', (_e, result) => {
      this.find = { ...this.find, active: result.activeMatchOrdinal, matches: result.matches }
      host.changed(this)
    })
    wc.on('audio-state-changed', (e) => {
      this.audible = e.audible
      if (e.audible) this.heard = true
      host.changed(this)
    })
    wc.on('enter-html-full-screen', () => host.htmlFullscreen(this, true))
    wc.on('leave-html-full-screen', () => host.htmlFullscreen(this, false))
    wc.on('zoom-changed', (_e, dir) => {
      const z = wc.getZoomFactor()
      wc.setZoomFactor(clampZoom(dir === 'in' ? z + 0.1 : z - 0.1))
      host.changed(this)
    })
    wc.on('will-prevent-unload', (e) => {
      // A page asked to confirm leaving (unsaved changes).
      this.unloadPrompted = true
      const choice = dialog.showMessageBoxSync({
        type: 'question',
        buttons: ['Leave', 'Stay'],
        defaultId: 1,
        cancelId: 1,
        title: 'Leave site?',
        message: 'Leave site?',
        detail: 'Changes you made may not be saved.'
      })
      this.unloadPrompted = false
      if (choice === 0) e.preventDefault()
      else {
        this.closing = false
        host.changed(this)
      }
    })
    wc.on('destroyed', () => {
      // A page that called window.close() on itself (popups, OAuth flows).
      if (this.view?.webContents === wc && !this.closing) {
        this.view = null
        this.closing = true
        host.finalizeClose(this)
      }
    })
  }

  private recordVisit(url: string): void {
    const typed = this.pendingTyped
    this.pendingTyped = false
    if (this.host.incognito || internalPage(url)) return
    try {
      ctx.history.addVisit(url, this.title && this.wc?.getURL() === url ? this.title : '', typed)
    } catch (err) {
      log.error('history write failed', err)
    }
  }

  private syncFavicon(url: string): void {
    const cached = ctx.favicons.get(hostOf(url))
    const next = internalPage(url) ? null : (cached?.data ?? null)
    if (next !== this.favicon) {
      this.favicon = next
      this.accent = cached?.accent ?? null
    }
  }

  private async loadFavicon(urls: string[]): Promise<void> {
    const url = urls.find((u) => /^(https?|data):/.test(u))
    const pageHost = hostOf(this.wc?.getURL() ?? '')
    if (!url || !pageHost || url === this.faviconUrl) return
    this.faviconUrl = url
    try {
      const icon = await fetchFavicon(this.host.session, url)
      if (!icon) return
      if (!this.host.incognito) ctx.favicons.set(pageHost, icon.data, icon.accent)
      if (hostOf(this.wc?.getURL() ?? '') === pageHost) {
        this.favicon = icon.data
        this.accent = icon.accent
        this.host.changed(this)
      }
    } catch (err) {
      log.debug('favicon failed', url, err)
    }
  }

  /** IE7's orange feed button: find feeds the page links to. */
  private async detectFeeds(): Promise<void> {
    const wc = this.wc
    if (!wc || !/^https?:/.test(wc.getURL())) return
    try {
      const found = (await wc.executeJavaScriptInIsolatedWorld(999, [
        {
          code: `[...document.querySelectorAll('link[rel~="alternate" i][href]')]
            .filter((l) => ['application/rss+xml', 'application/atom+xml'].includes((l.type || '').trim().toLowerCase()) && /^https?:/.test(l.href))
            .slice(0, 8)
            .map((l) => ({ title: (l.title || '').slice(0, 200), url: l.href }))`
        }
      ])) as FeedLink[] | null
      const feeds = Array.isArray(found) ? found.filter((f) => typeof f?.url === 'string' && typeof f.title === 'string') : []
      if (JSON.stringify(feeds) !== JSON.stringify(this.feeds)) {
        this.feeds = feeds
        this.host.changed(this)
      }
    } catch {
      /* navigated away */
    }
  }

  /** Title and artist from the Media Session API, when the site sets them. */
  private async readMediaMetadata(): Promise<void> {
    const wc = this.wc
    if (!wc) return
    try {
      const m = (await wc.executeJavaScriptInIsolatedWorld(997, [
        { code: `(() => { const d = navigator.mediaSession && navigator.mediaSession.metadata; return d ? { title: String(d.title || ''), artist: String(d.artist || '') } : null })()` }
      ])) as { title: string; artist: string } | null
      if (!this.media) return
      this.media = { ...this.media, title: m?.title.slice(0, 200) ?? '', artist: m?.artist.slice(0, 200) ?? '' }
      this.host.changed(this)
    } catch {
      /* navigated away */
    }
  }

  private async checkReaderable(): Promise<void> {
    const wc = this.wc
    if (!wc || !/^https?:/.test(wc.getURL())) return
    try {
      // Runs in an isolated world: the page cannot observe or tamper with it.
      const ok = await wc.executeJavaScriptInIsolatedWorld(999, [
        {
          code: `(() => { const t = (document.querySelector('article, main, [role=main]') || document.body)?.innerText || ''; return document.querySelectorAll('p').length >= 4 && t.length > 1800 })()`
        }
      ])
      if (this.readerable !== !!ok) {
        this.readerable = !!ok
        this.host.changed(this)
      }
    } catch {
      /* navigated away */
    }
  }
}

export const clampZoom = (z: number) => Math.round(Math.min(3, Math.max(0.3, z)) * 100) / 100

// ---- favicons ------------------------------------------------------------------

async function fetchFavicon(ses: Session, url: string): Promise<{ data: string; accent: string | null } | null> {
  let bytes: Buffer
  let type = ''
  if (url.startsWith('data:')) {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url)
    if (!m) return null
    type = m[1]
    bytes = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]))
  } else {
    const res = await ses.fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'force-cache' } as RequestInit)
    if (!res.ok) return null
    type = res.headers.get('content-type') ?? ''
    bytes = Buffer.from(await res.arrayBuffer())
  }
  if (bytes.length > 512 * 1024) return null
  if (type.includes('svg') || /^\s*(<\?xml|<svg)/.test(bytes.subarray(0, 100).toString())) {
    // SVG renders safely inside <img>; scripts never run there.
    return { data: 'data:image/svg+xml;base64,' + bytes.toString('base64'), accent: null }
  }
  let img = nativeImage.createFromBuffer(bytes)
  if (img.isEmpty() && isIco(bytes)) {
    const ico = decodeIco(bytes)
    if (ico?.kind === 'png') img = nativeImage.createFromBuffer(ico.data)
    else if (ico) img = nativeImage.createFromBitmap(ico.data, { width: ico.width, height: ico.height })
  }
  if (img.isEmpty()) return null
  const icon = img.getSize().width > 32 ? img.resize({ width: 32, height: 32, quality: 'best' }) : img
  return { data: icon.toDataURL(), accent: accentOf(icon) }
}

/** Saturation-weighted average colour, lifted for use as a glow. */
export function accentOf(img: Electron.NativeImage): string | null {
  const bmp = img.toBitmap() // BGRA
  let r = 0
  let g = 0
  let b = 0
  let wsum = 0
  for (let i = 0; i < bmp.length; i += 4) {
    const a = bmp[i + 3] / 255
    if (a < 0.5) continue
    const B = bmp[i]
    const G = bmp[i + 1]
    const R = bmp[i + 2]
    const max = Math.max(R, G, B)
    const min = Math.min(R, G, B)
    const sat = max === 0 ? 0 : (max - min) / max
    const w = sat * sat * a
    r += R * w
    g += G * w
    b += B * w
    wsum += w
  }
  if (wsum < 2) return null
  r /= wsum
  g /= wsum
  b /= wsum
  // Normalise brightness so dark icons still glow.
  const m = Math.max(r, g, b) || 1
  const k = 235 / m
  const hex = (v: number) => Math.round(Math.min(255, v * k)).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}
