// Every browser command in one registry. Keyboard shortcuts, the app menu
// and the command palette are all views of this list.
import { app } from 'electron'
import { BrowserWin } from './window'
import type { Tab } from './tab'
import { clampZoom } from './tab'
import { settings } from './context'
import { NEW_TAB_URL, SCHEME, internalPage } from '../shared/url'
import { openReader, pictureInPicture, screenshot, showQr } from './tools'
import { logger } from './log'

const log = logger('commands')

export interface Command {
  id: string
  label: string
  section: 'Tabs' | 'Navigation' | 'Page' | 'Tools' | 'Browser' | 'Spaces'
  /** Display form, e.g. "Ctrl+Shift+T" */
  shortcut?: string
  keywords?: string
  enabled?: (win: BrowserWin, tab: Tab | null) => boolean
  run: (win: BrowserWin, tab: Tab | null) => void
}

const web = (tab: Tab | null) => !!tab && /^https?:/.test(tab.displayUrl())

/** Open an internal page, reusing a tab that already shows it. */
export function openInternal(win: BrowserWin, page: string, sub = ''): void {
  const target = `${SCHEME}://${page}/${sub}`
  const existing = win.tabs.find((t) => !t.closing && internalPage(t.displayUrl()) === page)
  if (existing) {
    win.activate(existing)
    if (sub) existing.navigate(target)
    return
  }
  const active = win.activeTab
  if (active && active.displayUrl().startsWith(NEW_TAB_URL)) active.navigate(target)
  else win.createTab({ url: target })
}

function zoom(tab: Tab | null, delta: number): void {
  const wc = tab?.wc
  if (!wc) return
  const next = delta === 0 ? settings.get().defaultZoom : clampZoom(wc.getZoomFactor() + delta)
  wc.setZoomFactor(next)
  tab!.host.changed(tab!)
}

function cycle(win: BrowserWin, dir: 1 | -1): void {
  const v = win.visibleTabs()
  const a = win.activeTab
  if (!a || v.length < 2) return
  win.activate(v[(v.indexOf(a) + dir + v.length) % v.length])
}

function cycleSpace(win: BrowserWin, dir: 1 | -1): void {
  const i = win.spaces.findIndex((s) => s.id === win.activeSpaceId)
  win.switchSpace(win.spaces[(i + dir + win.spaces.length) % win.spaces.length].id)
}

export const COMMANDS: Command[] = [
  // tabs
  { id: 'new-tab', label: 'New tab', section: 'Tabs', shortcut: 'Ctrl+T', run: (w) => w.createTab({ url: NEW_TAB_URL }) },
  { id: 'new-window', label: 'New window', section: 'Browser', shortcut: 'Ctrl+N', run: () => void new BrowserWin() },
  { id: 'new-private', label: 'New InPrivate window', section: 'Browser', shortcut: 'Ctrl+Shift+N', keywords: 'incognito private', run: () => void new BrowserWin({ incognito: true }) },
  { id: 'reopen-tab', label: 'Reopen closed tab', section: 'Tabs', shortcut: 'Ctrl+Shift+T', run: (w) => w.reopenClosed() },
  { id: 'close-tab', label: 'Close tab', section: 'Tabs', shortcut: 'Ctrl+W', run: (w, t) => t && w.closeTab(t) },
  { id: 'close-window', label: 'Close window', section: 'Browser', shortcut: 'Ctrl+Shift+W', run: (w) => w.win.close() },
  { id: 'next-tab', label: 'Next tab', section: 'Tabs', shortcut: 'Ctrl+Tab', run: (w) => cycle(w, 1) },
  { id: 'prev-tab', label: 'Previous tab', section: 'Tabs', shortcut: 'Ctrl+Shift+Tab', run: (w) => cycle(w, -1) },
  { id: 'duplicate-tab', label: 'Duplicate tab', section: 'Tabs', run: (w, t) => t && w.duplicate(t) },
  { id: 'pin-tab', label: 'Pin or unpin tab', section: 'Tabs', run: (w, t) => t && w.setPinned(t, !t.pinned) },
  { id: 'mute-tab', label: 'Mute or unmute tab', section: 'Tabs', shortcut: 'Ctrl+M', run: (_w, t) => t?.setMuted(!t.muted) },
  { id: 'sleep-tab', label: 'Put other tabs to sleep', section: 'Tabs', keywords: 'memory discard suspend', run: (w, t) => w.visibleTabs().forEach((x) => x !== t && !x.audible && x.sleep()) },
  { id: 'tab-flip', label: 'Tab Flip', section: 'Tabs', shortcut: 'Ctrl+Shift+A', keywords: 'overview search tabs expose', run: (w) => void import('./menus').then((m) => m.showTabFlip(w)) },
  { id: 'flip-3d', label: 'Flip 3D', section: 'Tabs', shortcut: 'Ctrl+Shift+F', keywords: 'stack switcher aero tabs 3d', run: (w) => void import('./menus').then((m) => m.showFlip3D(w)) },
  { id: 'split-view', label: 'Split view', section: 'Tabs', shortcut: 'Ctrl+Shift+E', keywords: 'side by side tile', run: (w) => w.toggleSplit() },
  // spaces
  { id: 'new-space', label: 'New space', section: 'Spaces', keywords: 'workspace', run: (w) => void w.createSpace() },
  { id: 'next-space', label: 'Next space', section: 'Spaces', shortcut: 'Ctrl+Shift+]', run: (w) => cycleSpace(w, 1) },
  { id: 'prev-space', label: 'Previous space', section: 'Spaces', shortcut: 'Ctrl+Shift+[', run: (w) => cycleSpace(w, -1) },
  // navigation
  { id: 'focus-address', label: 'Focus address bar', section: 'Navigation', shortcut: 'Ctrl+L', run: (w) => w.focusOmnibox() },
  { id: 'back', label: 'Back', section: 'Navigation', shortcut: 'Alt+Left', run: (_w, t) => t?.wc?.navigationHistory.goBack() },
  { id: 'forward', label: 'Forward', section: 'Navigation', shortcut: 'Alt+Right', run: (_w, t) => t?.wc?.navigationHistory.goForward() },
  { id: 'reload', label: 'Reload', section: 'Navigation', shortcut: 'Ctrl+R', run: (_w, t) => t?.reload() },
  { id: 'hard-reload', label: 'Reload without cache', section: 'Navigation', shortcut: 'Ctrl+Shift+R', run: (_w, t) => t?.reload(true) },
  { id: 'home', label: 'Home page', section: 'Navigation', shortcut: 'Alt+Home', run: (_w, t) => t?.navigate(settings.get().homePage) },
  // page
  { id: 'find', label: 'Find on page', section: 'Page', shortcut: 'Ctrl+F', run: (w, t) => {
      if (!t) return
      t.find = { ...t.find, open: true }
      w.pushState()
      w.chrome.focus()
      w.send('find.focus', null)
    } },
  { id: 'zoom-in', label: 'Zoom in', section: 'Page', shortcut: 'Ctrl++', run: (_w, t) => zoom(t, 0.1) },
  { id: 'zoom-out', label: 'Zoom out', section: 'Page', shortcut: 'Ctrl+-', run: (_w, t) => zoom(t, -0.1) },
  { id: 'zoom-reset', label: 'Reset zoom', section: 'Page', shortcut: 'Ctrl+0', run: (_w, t) => zoom(t, 0) },
  { id: 'bookmark', label: 'Add to Favorites', section: 'Page', shortcut: 'Ctrl+D', keywords: 'bookmark star', run: (w) => void import('./menus').then((m) => m.bookmarkCurrent(w)) },
  { id: 'print', label: 'Print…', section: 'Page', shortcut: 'Ctrl+P', enabled: (_w, t) => !!t?.wc, run: (_w, t) => t?.wc?.print({}, (ok, why) => !ok && why !== 'Print job canceled' && log.warn('print', why)) },
  { id: 'save-page', label: 'Save page as…', section: 'Page', shortcut: 'Ctrl+S', enabled: (_w, t) => web(t), run: (w, t) => void import('./menus').then((m) => m.savePage(w, t)) },
  { id: 'view-source', label: 'View page source', section: 'Page', shortcut: 'Ctrl+U', enabled: (_w, t) => web(t), run: (w, t) => t && w.createTab({ url: `view-source:${t.displayUrl()}`, openerId: t.id }, { afterOpener: true }) },
  { id: 'devtools', label: 'Developer tools', section: 'Page', shortcut: 'F12', keywords: 'inspect console', run: (_w, t) => t?.wc?.toggleDevTools() },
  { id: 'reader', label: 'Reader view', section: 'Page', shortcut: 'F9', keywords: 'article read immersive', enabled: (_w, t) => web(t), run: (w, t) => t && void openReader(w, t) },
  // tools
  { id: 'screenshot', label: 'Take screenshot', section: 'Tools', shortcut: 'Ctrl+Shift+S', keywords: 'capture', enabled: (_w, t) => !!t?.wc, run: (w, t) => t && void screenshot(w, t, 'visible') },
  { id: 'screenshot-full', label: 'Take full-page screenshot', section: 'Tools', keywords: 'capture long scrolling', enabled: (_w, t) => !!t?.wc, run: (w, t) => t && void screenshot(w, t, 'full') },
  { id: 'qr', label: 'Create QR code for this page', section: 'Tools', keywords: 'share phone', enabled: (_w, t) => web(t), run: (w, t) => t && void showQr(w, t) },
  { id: 'pip', label: 'Picture-in-picture', section: 'Tools', keywords: 'video float', enabled: (_w, t) => !!t?.wc, run: (w, t) => t && void pictureInPicture(w, t) },
  { id: 'task-manager', label: 'Task Manager', section: 'Tools', shortcut: 'Shift+Esc', keywords: 'memory cpu processes', run: (w) => openInternal(w, 'taskmanager') },
  { id: 'palette', label: 'Command palette', section: 'Tools', shortcut: 'Ctrl+K', run: (w) => void import('./menus').then((m) => m.showPalette(w)) },
  // browser
  { id: 'history', label: 'History', section: 'Browser', shortcut: 'Ctrl+H', run: (w) => openInternal(w, 'history') },
  { id: 'downloads', label: 'Downloads', section: 'Browser', shortcut: 'Ctrl+J', run: (w) => openInternal(w, 'downloads') },
  { id: 'favorites', label: 'Favorites', section: 'Browser', shortcut: 'Ctrl+Shift+O', keywords: 'bookmarks manager', run: (w) => openInternal(w, 'bookmarks') },
  { id: 'toggle-bar', label: 'Show or hide Favorites bar', section: 'Browser', shortcut: 'Ctrl+Shift+B', run: () => settings.set({ showBookmarksBar: !settings.get().showBookmarksBar }) },
  { id: 'toggle-sidebar', label: 'Show or hide the Sidebar', section: 'Browser', keywords: 'gadgets panel widgets', run: () => settings.set({ sidebar: !settings.get().sidebar }) },
  { id: 'extensions', label: 'Extensions', section: 'Browser', keywords: 'add-ons plugins chrome web store', run: (w) => openInternal(w, 'extensions') },
  { id: 'welcome', label: 'Welcome Center', section: 'Browser', keywords: 'getting started first run tour', run: (w) => openInternal(w, 'welcome') },
  { id: 'toggle-status', label: 'Show or hide status bar', section: 'Browser', shortcut: 'Ctrl+/', run: () => settings.set({ showStatusBar: !settings.get().showStatusBar }) },
  { id: 'settings', label: 'Settings', section: 'Browser', shortcut: 'Ctrl+,', keywords: 'options preferences', run: (w) => openInternal(w, 'settings') },
  { id: 'clear-data', label: 'Clear browsing data…', section: 'Browser', shortcut: 'Ctrl+Shift+Del', keywords: 'privacy cookies cache', run: (w) => openInternal(w, 'settings', '#clear') },
  { id: 'fullscreen', label: 'Full screen', section: 'Browser', shortcut: 'F11', run: (w) => w.win.setFullScreen(!w.win.isFullScreen()) },
  { id: 'about', label: 'About Auralis', section: 'Browser', run: (w) => openInternal(w, 'about') },
  { id: 'quit', label: 'Exit', section: 'Browser', shortcut: 'Ctrl+Shift+Q', run: () => app.quit() }
]

export const commandById = new Map(COMMANDS.map((c) => [c.id, c]))

export function runCommand(win: BrowserWin, id: string): boolean {
  const cmd = commandById.get(id)
  if (!cmd) return false
  const tab = win.activeTab
  if (cmd.enabled && !cmd.enabled(win, tab)) return false
  try {
    cmd.run(win, tab)
  } catch (err) {
    log.error('command failed', id, err)
  }
  return true
}
