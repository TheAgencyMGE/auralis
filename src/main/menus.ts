// Everything that opens in the overlay: context menus, the app menu,
// popovers and prompts. Each builder maps overlay action ids to closures.
import { dialog, nativeImage, shell, type ContextMenuParams } from 'electron'
import { copyPng, copyText } from './clip'
import path from 'node:path'
import { BrowserWin, type MenuSpec } from './window'
import type { Tab } from './tab'
import { COMMANDS, commandById, runCommand, openInternal } from './commands'
import { ctx, settings } from './context'
import { BAR_ID } from './data/bookmarks'
import { downloadAction, listDownloads } from './downloads'
import { certificateFor, PERMISSION_LABELS, PROMPTABLE, type PromptResult } from './web-session'
import { blockedFor, isShieldActiveFor } from './shield'
import { thumbsFor } from './tools'
import { SEARCH_ENGINES } from '../shared/settings'
import { NEW_TAB_URL, hostOf, originOf, resolveInput, searchUrl, securityOf, siteKey } from '../shared/url'
import type { Rect, SiteInfo, Space, SpaceColor } from '../shared/types'
import { logger } from './log'

const log = logger('menus')

const point = (x: number, y: number): Rect => ({ x, y, width: 0, height: 0 })

// ---- page context menu ----------------------------------------------------------

export function showPageMenu(win: BrowserWin, tab: Tab, p: ContextMenuParams): void {
  const wc = tab.wc
  if (!wc) return
  const bounds = tab.view?.getBounds() ?? { x: 0, y: 0 }
  const at = point(bounds.x + p.x, bounds.y + p.y)
  const engine = SEARCH_ENGINES[settings.get().searchEngine].name
  const items: MenuSpec[] = []
  const sep = () => items.length && items[items.length - 1].type !== 'separator' && items.push({ type: 'separator' })
  const isWebLink = /^(https?|file):/i.test(p.linkURL)

  if (p.misspelledWord) {
    for (const s of p.dictionarySuggestions.slice(0, 5)) items.push({ label: s, click: () => wc.replaceMisspelling(s) })
    if (!p.dictionarySuggestions.length) items.push({ label: 'No spelling suggestions', disabled: true })
    items.push({ label: 'Add to dictionary', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) })
    sep()
  }
  if (p.linkURL && isWebLink) {
    items.push(
      { label: 'Open link in new tab', icon: 'tab-new', click: () => win.createTab({ url: p.linkURL, openerId: tab.id }, { activate: false, afterOpener: true }) },
      { label: 'Open link in split view', icon: 'split', click: () => {
          const t = win.createTab({ url: p.linkURL, openerId: tab.id }, { activate: false, afterOpener: true })
          win.openSplit(tab, t)
        } },
      { label: 'Open link in new window', click: () => void new BrowserWin({ incognito: win.incognito, initialUrls: [p.linkURL] }) },
      { label: 'Open link in InPrivate window', click: () => void new BrowserWin({ incognito: true, initialUrls: [p.linkURL] }) },
      { type: 'separator' },
      { label: 'Save link as…', click: () => wc.downloadURL(p.linkURL) },
      { label: 'Copy link address', icon: 'link', click: () => copyText(p.linkURL) }
    )
    sep()
  }
  if (p.mediaType === 'image' && p.srcURL) {
    items.push(
      { label: 'Open image in new tab', click: () => win.createTab({ url: p.srcURL, openerId: tab.id }, { activate: false, afterOpener: true }) },
      { label: 'Save image as…', click: () => wc.downloadURL(p.srcURL) },
      { label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) },
      { label: 'Copy image address', click: () => copyText(p.srcURL) }
    )
    sep()
  }
  if ((p.mediaType === 'video' || p.mediaType === 'audio') && p.srcURL) {
    const f = p.mediaFlags
    items.push(
      { label: f.isPaused ? 'Play' : 'Pause', click: () => wc.executeJavaScript(`(()=>{const m=document.elementFromPoint(${p.x},${p.y});if(m&&m.paused!==undefined){m.paused?m.play():m.pause()}})()`, true) },
      { label: 'Loop', checked: f.isLooping, click: () => wc.executeJavaScript(`(()=>{const m=document.elementFromPoint(${p.x},${p.y});if(m&&'loop' in m)m.loop=!m.loop})()`, true) },
      ...(p.mediaType === 'video' ? [{ label: 'Picture-in-picture', icon: 'pip', click: () => runCommand(win, 'pip') }] : []),
      { label: `Save ${p.mediaType} as…`, click: () => /^https?:/.test(p.srcURL) && wc.downloadURL(p.srcURL) },
      { label: `Copy ${p.mediaType} address`, click: () => copyText(p.srcURL) }
    )
    sep()
  }
  if (p.isEditable) {
    const ef = p.editFlags
    items.push(
      { label: 'Undo', accelerator: 'Ctrl+Z', disabled: !ef.canUndo, click: () => wc.undo() },
      { label: 'Redo', accelerator: 'Ctrl+Y', disabled: !ef.canRedo, click: () => wc.redo() },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'Ctrl+X', disabled: !ef.canCut, click: () => wc.cut() },
      { label: 'Copy', accelerator: 'Ctrl+C', disabled: !ef.canCopy, click: () => wc.copy() },
      { label: 'Paste', accelerator: 'Ctrl+V', disabled: !ef.canPaste, click: () => wc.paste() },
      { label: 'Paste as plain text', accelerator: 'Ctrl+Shift+V', disabled: !ef.canPaste, click: () => wc.pasteAndMatchStyle() },
      { label: 'Select all', accelerator: 'Ctrl+A', disabled: !ef.canSelectAll, click: () => wc.selectAll() }
    )
    sep()
  } else if (p.selectionText.trim()) {
    const text = p.selectionText.trim()
    const short = text.length > 28 ? text.slice(0, 27) + '…' : text
    items.push({ label: 'Copy', accelerator: 'Ctrl+C', icon: 'copy', click: () => wc.copy() })
    const resolved = resolveInput(text, settings.get().searchEngine)
    if (resolved.kind === 'url' && !/\s/.test(text)) items.push({ label: `Go to ${short}`, click: () => win.createTab({ url: resolved.url, openerId: tab.id }, { afterOpener: true }) })
    items.push({ label: `Search ${engine} for “${short}”`, icon: 'search', click: () => win.createTab({ url: searchUrl(text, settings.get().searchEngine), openerId: tab.id }, { afterOpener: true }) })
    sep()
  }
  if (!p.linkURL && !p.srcURL && !p.isEditable && !p.selectionText.trim()) {
    items.push(
      { label: 'Back', accelerator: 'Alt+Left', icon: 'back', disabled: !wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: 'Forward', accelerator: 'Alt+Right', icon: 'forward', disabled: !wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: 'Reload', accelerator: 'Ctrl+R', icon: 'reload', click: () => tab.reload() },
      { type: 'separator' },
      { label: 'Save page as…', accelerator: 'Ctrl+S', click: () => runCommand(win, 'save-page') },
      { label: 'Print…', accelerator: 'Ctrl+P', icon: 'print', click: () => runCommand(win, 'print') },
      { label: 'Reader view', accelerator: 'F9', icon: 'reader', disabled: !tab.readerable, click: () => runCommand(win, 'reader') },
      { label: 'Take screenshot', accelerator: 'Ctrl+Shift+S', icon: 'camera', click: () => runCommand(win, 'screenshot') },
      { label: 'Create QR code', icon: 'qr', click: () => runCommand(win, 'qr') }
    )
    sep()
  }
  if (/^https?:/.test(wc.getURL())) items.push({ label: 'View page source', accelerator: 'Ctrl+U', click: () => runCommand(win, 'view-source') })
  items.push({ label: 'Inspect', accelerator: 'F12', click: () => wc.inspectElement(p.x, p.y) })
  win.menu(at, items)
}

// ---- tab menu ------------------------------------------------------------------------

export function showTabMenu(win: BrowserWin, tab: Tab, anchor: Rect): void {
  const active = win.activeTab
  const otherSpaces = win.spaces.filter((s) => s.id !== tab.spaceId)
  win.menu(anchor, [
    { label: 'New tab to the right', icon: 'tab-new', click: () => win.createTab({ url: NEW_TAB_URL }, { index: win.tabs.indexOf(tab) + 1 }) },
    { type: 'separator' },
    { label: 'Reload', icon: 'reload', click: () => tab.reload() },
    { label: 'Duplicate', click: () => win.duplicate(tab) },
    { label: tab.pinned ? 'Unpin' : 'Pin', icon: 'pin', click: () => win.setPinned(tab, !tab.pinned) },
    { label: tab.muted ? 'Unmute site' : 'Mute site', icon: tab.muted ? 'volume' : 'mute', click: () => tab.setMuted(!tab.muted) },
    { label: 'Put to sleep', icon: 'sleep', disabled: !tab.wc || tab === active, click: () => tab.sleep() },
    { type: 'separator' },
    {
      label: 'Open in split view',
      icon: 'split',
      disabled: !active || active === tab,
      click: () => active && win.openSplit(active, tab)
    },
    {
      label: 'Move to space',
      icon: 'spaces',
      submenu: [
        ...otherSpaces.map((s) => ({ label: s.name, icon: `space-${s.color}`, click: () => win.moveTabToSpace(tab, s.id) })),
        ...(otherSpaces.length ? [{ type: 'separator' as const }] : []),
        { label: 'New space', click: () => {
            const from = win.activeSpaceId
            const s = win.createSpace()
            win.switchSpace(from)
            win.moveTabToSpace(tab, s.id)
            win.switchSpace(s.id)
          } }
      ]
    },
    { label: 'Move to new window', click: () => win.moveTabToWindow(tab, null) },
    { type: 'separator' },
    { label: 'Close', accelerator: 'Ctrl+W', click: () => win.closeTab(tab) },
    { label: 'Close other tabs', click: () => win.closeOthers(tab) },
    { label: 'Close tabs to the right', click: () => win.closeToRight(tab) },
    { label: 'Reopen closed tab', accelerator: 'Ctrl+Shift+T', click: () => win.reopenClosed() }
  ])
}

// ---- app menu (the Auralis orb) ---------------------------------------------------------

const APP_LEFT = ['new-tab', 'new-window', 'new-private', '-', 'find', 'print', 'save-page', 'screenshot', 'reader', 'split-view', 'tab-flip']
const APP_RIGHT = ['favorites', 'history', 'downloads', 'task-manager', 'settings', 'about']

export function showAppMenu(win: BrowserWin, anchor: Rect): void {
  const tab = win.activeTab
  const toItem = (id: string) => {
    if (id === '-') return { type: 'separator' as const }
    const c = commandById.get(id)!
    return { id: `cmd:${id}`, label: c.label, accelerator: c.shortcut, icon: id, disabled: c.enabled ? !c.enabled(win, tab) : false }
  }
  const recent = ctx.history.search('', 6).map((h) => ({ title: h.title || h.url, url: h.url, favicon: ctx.favicons.get(hostOf(h.url))?.data ?? null }))
  win.showOverlay(
    {
      content: {
        kind: 'appmenu',
        items: [
          ...APP_LEFT.map(toItem),
          { type: 'header', label: 'zoom', id: `zoom:${Math.round((tab?.wc?.getZoomFactor() ?? 1) * 100)}` },
          ...APP_RIGHT.map((id) => ({ ...toItem(id), checked: true }))
        ],
        recent,
        incognito: win.incognito
      },
      anchor,
      align: 'start'
    },
    (id, payload) => {
      if (id.startsWith('cmd:')) {
        win.overlay.hide()
        setImmediate(() => runCommand(win, id.slice(4)))
      } else if (id === 'zoom-in' || id === 'zoom-out' || id === 'zoom-reset') {
        runCommand(win, id)
        showAppMenu(win, anchor)
      } else if (id === 'recent' && typeof payload === 'string' && /^https?:/.test(payload)) {
        win.overlay.hide()
        win.createTab({ url: payload })
      } else if (id === 'search') {
        win.overlay.hide()
        setImmediate(() => showPalette(win, typeof payload === 'string' ? payload : ''))
      }
    }
  )
}

// ---- site info ------------------------------------------------------------------------------

export async function siteInfo(win: BrowserWin, tab: Tab): Promise<SiteInfo> {
  const url = tab.displayUrl()
  const host = hostOf(url)
  const origin = originOf(url)
  const cert = host ? certificateFor(host) : null
  let cookies = 0
  try {
    if (/^https?:/.test(url)) cookies = (await win.session.cookies.get({ url })).length
  } catch {
    /* ignore */
  }
  const stored = win.incognito ? [] : ctx.permissions.forOrigin(origin)
  return {
    url,
    origin,
    host,
    security: tab.error?.type === 'cert' ? 'error' : securityOf(url, cert ? !cert.ok : false),
    certificate: cert
      ? {
          subject: cert.cert.subjectName,
          issuer: cert.cert.issuerName,
          validFrom: cert.cert.validStart * 1000,
          validTo: cert.cert.validExpiry * 1000,
          fingerprint: cert.cert.fingerprint
        }
      : null,
    permissions: stored,
    shieldEnabled: settings.get().shieldEnabled,
    shieldActive: isShieldActiveFor(url),
    blocked: tab.wc ? blockedFor(tab.wc.id) : 0,
    cookies
  }
}

export async function showSiteInfo(win: BrowserWin, anchor: Rect): Promise<void> {
  const tab = win.activeTab
  if (!tab) return
  const render = async () =>
    win.showOverlay({ content: { kind: 'siteinfo', info: await siteInfo(win, tab) }, anchor, align: 'start' }, (id, payload) => void act(id, payload))
  const act = async (id: string, payload: unknown) => {
    const url = tab.displayUrl()
    const origin = originOf(url)
    if (id === 'shield') {
      const key = siteKey(url)
      const list = settings.get().shieldAllowlist
      settings.set({ shieldAllowlist: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] })
      tab.reload()
      await render()
    } else if (id === 'permission' && payload && typeof payload === 'object') {
      const { permission, decision } = payload as { permission: string; decision: string }
      if (!PROMPTABLE.has(permission)) return
      if (decision === 'reset') ctx.permissions.remove(origin, permission)
      else if (decision === 'allow' || decision === 'deny') ctx.permissions.set(origin, permission, decision)
      await render()
    } else if (id === 'clear') {
      await win.session.clearStorageData({ origin })
      win.overlay.hide()
      tab.reload()
      win.toast(`Cleared cookies and site data for ${hostOf(url)}`)
    } else if (id === 'settings') {
      win.overlay.hide()
      openInternal(win, 'settings', '#permissions')
    }
  }
  await render()
}

// ---- permission prompts ------------------------------------------------------------------------

let promptId = 0
export function promptPermission(win: BrowserWin, tab: Tab, origin: string, permissions: string[], extra?: { externalUrl?: string }): Promise<PromptResult> {
  return new Promise((resolve) => {
    let done = false
    const finish = (r: PromptResult) => {
      if (done) return
      done = true
      resolve(r)
    }
    const show = () => {
      if (tab.closing) return finish('dismiss')
      const anchor = win.anchors.siteInfo ?? { x: 120, y: 80, width: 20, height: 20 }
      const labels = permissions.map((p) => PERMISSION_LABELS[p] ?? p)
      if (extra?.externalUrl) labels[0] = `Open ${new URL(extra.externalUrl).protocol.replace(':', '')} link with another app`
      win.showOverlay(
        { content: { kind: 'permission', prompt: { id: ++promptId, origin, permissions: labels } }, anchor, align: 'start' },
        (id) => {
          win.overlay.hide()
          finish(id === 'allow' ? 'allow' : id === 'deny' ? 'deny' : 'dismiss')
        },
        () => finish('dismiss')
      )
    }
    if (win.activeTab === tab) show()
    else {
      // Background tabs wait until they are looked at; then ask.
      const timer = setInterval(() => {
        if (tab.closing || win.win.isDestroyed()) {
          clearInterval(timer)
          finish('dismiss')
        } else if (win.activeTab === tab) {
          clearInterval(timer)
          show()
        }
      }, 400)
    }
  })
}

// ---- downloads popover -------------------------------------------------------------------------------

export function showDownloads(win: BrowserWin, anchor: Rect): void {
  const render = () => win.showOverlay({ content: { kind: 'downloads', items: listDownloads().slice(0, 6) }, anchor, align: 'end' }, act)
  const act = (id: string, payload: unknown) => {
    if (id === 'all') {
      win.overlay.hide()
      openInternal(win, 'downloads')
      return
    }
    if (typeof payload === 'string') downloadAction(payload, id)
    if (id === 'open' || id === 'show') win.overlay.hide()
    else render()
  }
  render()
}

// ---- spaces popover ------------------------------------------------------------------------------------

export function showSpaces(win: BrowserWin, anchor: Rect): void {
  const render = () => {
    const counts: Record<string, number> = {}
    for (const t of win.tabs) if (!t.closing) counts[t.spaceId] = (counts[t.spaceId] ?? 0) + 1
    win.showOverlay({ content: { kind: 'spaces', spaces: win.spaces, activeSpaceId: win.activeSpaceId, counts }, anchor, align: 'start' }, act)
  }
  const act = (id: string, payload: unknown) => {
    const p = (payload ?? {}) as { id?: string; name?: string; color?: SpaceColor }
    if (id === 'switch' && p.id) {
      win.overlay.hide()
      win.switchSpace(p.id)
      return
    }
    if (id === 'new') {
      win.overlay.hide()
      win.createSpace(p.name)
      return
    }
    if (id === 'update' && p.id) win.updateSpace(p.id, { name: p.name, color: p.color })
    if (id === 'delete' && p.id) {
      const space = win.spaces.find((s) => s.id === p.id) as Space
      const n = win.tabs.filter((t) => t.spaceId === p.id).length
      win.confirm(
        { title: `Delete “${space.name}”?`, message: n ? `Its ${n} tab${n === 1 ? '' : 's'} will be closed.` : 'This space has no tabs.', confirm: 'Delete', cancel: 'Cancel' },
        () => win.deleteSpace(p.id!)
      )
      return
    }
    render()
  }
  render()
}

// ---- favorites ------------------------------------------------------------------------------------------

export function bookmarkCurrent(win: BrowserWin, anchor?: Rect): void {
  const tab = win.activeTab
  if (!tab) return
  const url = tab.displayUrl()
  if (!/^(https?|file):/.test(url)) return
  let node = ctx.bookmarks.findByUrl(url)
  if (!node) node = ctx.bookmarks.create({ parentId: BAR_ID, kind: 'url', title: tab.title || url, url })
  win.pushState()
  const id = node.id
  win.showOverlay(
    {
      content: { kind: 'bookmark', id, title: node.title, folderId: node.parentId ?? BAR_ID, folders: ctx.bookmarks.folders() },
      anchor: anchor ?? win.anchors.star ?? point(600, 80),
      align: 'end'
    },
    (action, payload) => {
      if (action === 'save' && payload && typeof payload === 'object') {
        const p = payload as { title?: string; folderId?: number }
        try {
          if (typeof p.title === 'string') ctx.bookmarks.update(id, { title: p.title })
          if (typeof p.folderId === 'number' && p.folderId !== ctx.bookmarks.get(id)?.parentId) ctx.bookmarks.move(id, p.folderId, 1e9)
        } catch (err) {
          log.warn('bookmark save', err)
        }
      } else if (action === 'remove') {
        ctx.bookmarks.remove(id)
      }
      win.overlay.hide()
      win.pushState()
    }
  )
}

export function openBookmark(win: BrowserWin, url: string, disposition: 'current' | 'tab' | 'background' | 'window' | 'private'): void {
  if (!/^(https?|file|auralis):/.test(url)) return
  if (disposition === 'window') void new BrowserWin({ initialUrls: [url] })
  else if (disposition === 'private') void new BrowserWin({ incognito: true, initialUrls: [url] })
  else if (disposition === 'current' && win.activeTab) win.activeTab.navigate(url)
  else win.createTab({ url }, { activate: disposition !== 'background' })
}

export function showBookmarkFolder(win: BrowserWin, folderId: number, anchor: Rect): void {
  const build = (parentId: number, depth: number): MenuSpec[] => {
    const kids = ctx.bookmarks.children(parentId)
    if (!kids.length) return [{ label: '(Empty)', disabled: true }]
    const out: MenuSpec[] = kids.map((n) =>
      n.kind === 'folder'
        ? { label: n.title, icon: 'folder', submenu: depth < 6 ? build(n.id, depth + 1) : [] }
        : { label: n.title || n.url!, icon: `favicon:${hostOf(n.url!)}`, click: () => openBookmark(win, n.url!, 'current') }
    )
    const urls = kids.filter((k) => k.kind === 'url').map((k) => k.url!)
    if (urls.length > 1) out.push({ type: 'separator' }, { label: `Open all (${urls.length})`, click: () => urls.forEach((u) => win.createTab({ url: u }, { activate: false })) })
    return out
  }
  win.menu(anchor, build(folderId, 0), 'start', 220)
}

export function showBookmarkItemMenu(win: BrowserWin, id: number, anchor: Rect): void {
  const n = ctx.bookmarks.get(id)
  if (!n) return
  const specs: MenuSpec[] =
    n.kind === 'url'
      ? [
          { label: 'Open', click: () => openBookmark(win, n.url!, 'current') },
          { label: 'Open in new tab', icon: 'tab-new', click: () => openBookmark(win, n.url!, 'background') },
          { label: 'Open in new window', click: () => openBookmark(win, n.url!, 'window') },
          { label: 'Open in InPrivate window', click: () => openBookmark(win, n.url!, 'private') },
          { type: 'separator' },
          { label: 'Copy link', icon: 'link', click: () => copyText(n.url!) },
          { label: 'Edit…', click: () => openInternal(win, 'bookmarks', `?edit=${n.id}`) },
          { label: 'Delete', danger: true, click: () => (ctx.bookmarks.remove(n.id), win.pushState()) }
        ]
      : [
          { label: 'Open all', click: () => ctx.bookmarks.children(n.id).filter((k) => k.url).forEach((k) => openBookmark(win, k.url!, 'background')) },
          { label: 'Manage favorites', click: () => openInternal(win, 'bookmarks') },
          { type: 'separator' },
          { label: 'Delete folder', danger: true, click: () => (ctx.bookmarks.remove(n.id), win.pushState()) }
        ]
  win.menu(anchor, specs)
}

export function showChromeMenu(win: BrowserWin, anchor: Rect): void {
  const s = settings.get()
  win.menu(anchor, [
    { label: 'Show Favorites bar', checked: s.showBookmarksBar, accelerator: 'Ctrl+Shift+B', click: () => settings.set({ showBookmarksBar: !s.showBookmarksBar }) },
    { label: 'Show status bar', checked: s.showStatusBar, click: () => settings.set({ showStatusBar: !s.showStatusBar }) },
    { label: 'Show Home button', checked: s.showHomeButton, click: () => settings.set({ showHomeButton: !s.showHomeButton }) },
    { type: 'separator' },
    { label: 'Add current page to Favorites bar', icon: 'star', click: () => bookmarkCurrent(win) },
    { label: 'Manage favorites', click: () => openInternal(win, 'bookmarks') }
  ])
}

// ---- Tab Flip & command palette ------------------------------------------------------------------------

export async function showTabFlip(win: BrowserWin): Promise<void> {
  if (win.overlay.isOpen('tabflip')) return win.overlay.hide()
  const tabs = await thumbsFor(win, true)
  win.showOverlay({ content: { kind: 'tabflip', tabs, spaces: win.spaces }, anchor: point(0, 0), align: 'start', modal: true }, (id, payload) => {
    const tab = typeof payload === 'number' ? win.tabById(payload) : null
    if (id === 'activate' && tab) {
      win.overlay.hide()
      win.activate(tab)
    } else if (id === 'close' && tab) {
      win.closeTab(tab)
      void thumbsFor(win, true).then((t) => win.overlay.update({ kind: 'tabflip', tabs: t, spaces: win.spaces }))
    } else if (id === 'new') {
      win.overlay.hide()
      win.createTab({ url: NEW_TAB_URL })
    }
  })
}

export function showPalette(win: BrowserWin, query = ''): void {
  win.showOverlay({ content: { kind: 'palette', query }, anchor: point(0, 0), align: 'center', modal: true }, (id, payload) => {
    win.overlay.hide()
    const p = String(payload ?? '')
    if (id === 'command') setImmediate(() => runCommand(win, p))
    else if (id === 'tab') {
      for (const w of BrowserWin.all.values()) {
        const t = w.tabById(Number(p))
        if (t) {
          w.win.focus()
          w.activate(t)
        }
      }
    } else if (id === 'url' && /^(https?|file|auralis):/.test(p)) win.createTab({ url: p })
  })
}

export function paletteResults(win: BrowserWin, query: string) {
  const q = query.trim().toLowerCase()
  const score = (text: string) => {
    if (!q) return 1
    const t = text.toLowerCase()
    if (t.startsWith(q)) return 3
    if (t.includes(q)) return 2
    // subsequence match ("nwin" → "new window")
    let i = 0
    for (const ch of t) if (ch === q[i]) i++
    return i === q.length ? 1 : 0
  }
  const commands = COMMANDS.filter((c) => !c.enabled || c.enabled(win, win.activeTab))
    .map((c) => ({ c, s: Math.max(score(c.label), score(c.keywords ?? '') * 0.8) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, q ? 8 : 12)
    .map(({ c }) => ({ kind: 'command', id: c.id, title: c.label, subtitle: c.section, shortcut: c.shortcut ?? null, icon: c.id }))
  if (!q) return commands
  const tabs = [...BrowserWin.all.values()]
    .flatMap((w) => w.tabs.filter((t) => !t.closing))
    .filter((t) => score(t.title) || score(t.displayUrl()))
    .slice(0, 5)
    .map((t) => ({ kind: 'tab', id: String(t.id), title: t.title || t.displayUrl(), subtitle: 'Switch to tab', shortcut: null, icon: 'tab', favicon: t.favicon }))
  const marks = ctx.bookmarks.search(q, 4).map((b) => ({ kind: 'url', id: b.url!, title: b.title, subtitle: b.url!, shortcut: null, icon: 'star', favicon: ctx.favicons.get(hostOf(b.url!))?.data ?? null }))
  const hist = win.incognito ? [] : ctx.history.suggest(q, 4).map((h) => ({ kind: 'url', id: h.url, title: h.title || h.url, subtitle: h.url, shortcut: null, icon: 'history', favicon: ctx.favicons.get(hostOf(h.url))?.data ?? null }))
  return [...commands, ...tabs, ...marks, ...hist]
}

// ---- misc ------------------------------------------------------------------------------------------------------

export async function savePage(win: BrowserWin, tab: Tab | null): Promise<void> {
  const wc = tab?.wc
  if (!wc) return
  const name = (tab!.title || 'page').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 120)
  const r = await dialog.showSaveDialog(win.win, {
    defaultPath: path.join(settings.get().downloadDir, `${name}.html`),
    filters: [
      { name: 'Webpage, complete', extensions: ['html', 'htm'] },
      { name: 'Webpage, HTML only', extensions: ['html', 'htm'] },
      { name: 'Web archive (MHTML)', extensions: ['mhtml'] }
    ]
  })
  if (r.canceled || !r.filePath) return
  const type = r.filePath.endsWith('.mhtml') ? 'MHTML' : 'HTMLComplete'
  try {
    await wc.savePage(r.filePath, type)
    win.toast(`Saved “${path.basename(r.filePath)}”`)
  } catch (err) {
    log.warn('save page', err)
    win.toast('Couldn’t save this page.')
  }
}

export function showHistoryMenu(win: BrowserWin, dir: 'back' | 'forward', anchor: Rect): void {
  const wc = win.activeTab?.wc
  if (!wc) return
  const nav = wc.navigationHistory
  const entries = nav.getAllEntries()
  const cur = nav.getActiveIndex()
  const range = dir === 'back' ? entries.slice(Math.max(0, cur - 12), cur).map((e, i, a) => ({ e, idx: cur - a.length + i })).reverse() : entries.slice(cur + 1, cur + 13).map((e, i) => ({ e, idx: cur + 1 + i }))
  win.menu(anchor, [
    ...range.map(({ e, idx }) => ({ label: e.title || e.url, icon: `favicon:${hostOf(e.url)}`, click: () => nav.goToIndex(idx) })),
    { type: 'separator' },
    { label: 'Show full history', icon: 'history', accelerator: 'Ctrl+H', click: () => openInternal(win, 'history') }
  ], 'start', 260)
}

export function copyImage(dataUrl: string): void {
  copyPng(nativeImage.createFromDataURL(dataUrl).toPNG())
}

export function openExternalSafe(url: string): void {
  if (/^https?:/.test(url)) void shell.openExternal(url)
}
