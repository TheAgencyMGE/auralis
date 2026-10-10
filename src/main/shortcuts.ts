// Browser keyboard shortcuts. Handled in before-input-event of every
// webContents (chrome, overlay, tabs) so they work wherever focus is,
// without a native menu bar.
import type { WebContents } from 'electron'
import type { BrowserWin } from './window'
import { runCommand } from './commands'

function findStep(win: BrowserWin, forward: boolean): void {
  const tab = win.activeTab
  const wc = tab?.wc
  if (!tab || !wc) return
  if (!tab.find.open || !tab.find.text) return void runCommand(win, 'find')
  // Electron: findNext false = continue the current session.
  wc.findInPage(tab.find.text, { forward, findNext: false })
}

export function resolveShortcut(input: Pick<Electron.Input, 'key' | 'control' | 'shift' | 'alt' | 'meta'>): string | null {
  const { control: ctrl, shift, alt } = input
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key
  if (ctrl && !alt) {
    switch (key) {
      case 't': return shift ? 'reopen-tab' : 'new-tab'
      case 'n': return shift ? 'new-private' : 'new-window'
      case 'w': return shift ? 'close-window' : 'close-tab'
      case 'F4': return 'close-tab'
      case 'Tab': return shift ? 'prev-tab' : 'next-tab'
      case 'PageDown': return shift ? null : 'next-tab'
      case 'PageUp': return shift ? null : 'prev-tab'
      case 'l': return 'focus-address'
      case 'k': return 'palette'
      case 'r': return shift ? 'hard-reload' : 'reload'
      case 'F5': return 'hard-reload'
      case 'f': return shift ? 'flip-3d' : 'find'
      case 'g': return shift ? 'find-prev' : 'find-next'
      case '=': case '+': return 'zoom-in'
      case '-': case '_': return 'zoom-out'
      case '0': return shift ? null : 'zoom-reset'
      case 'd': return shift ? null : 'bookmark'
      case 'b': return shift ? 'toggle-bar' : null
      case 'o': return shift ? 'favorites' : null
      case 'h': return 'history'
      case 'j': return 'downloads'
      case 'p': return shift ? null : 'print'
      case 's': return shift ? 'screenshot' : 'save-page'
      case 'u': return 'view-source'
      case 'i': return shift ? 'devtools' : null
      case 'a': return shift ? 'tab-flip' : null
      case 'e': return shift ? 'split-view' : null
      case 'm': return shift ? null : 'mute-tab'
      case ',': return 'settings'
      case '/': return 'toggle-status'
      case 'Delete': return shift ? 'clear-data' : null
      case 'q': return shift ? 'quit' : null
      case ']': case '}': return shift ? 'next-space' : null
      case '[': case '{': return shift ? 'prev-space' : null
    }
    if (/^[1-9]$/.test(key) && !shift) return `goto-tab:${key}`
    return null
  }
  if (alt && !ctrl) {
    switch (key) {
      case 'ArrowLeft': return 'back'
      case 'ArrowRight': return 'forward'
      case 'Home': return 'home'
      case 'd': return 'focus-address'
    }
    return null
  }
  if (!ctrl && !alt) {
    switch (key) {
      case 'F5': return 'reload'
      case 'F6': return 'focus-address'
      case 'F11': return 'fullscreen'
      case 'F12': return 'devtools'
      case 'F9': return 'reader'
      case 'F3': return shift ? 'find-prev' : 'find-next'
      case 'Escape': return shift ? 'task-manager' : null
      case 'BrowserBack': return 'back'
      case 'BrowserForward': return 'forward'
      case 'BrowserRefresh': return 'reload'
      case 'BrowserHome': return 'home'
    }
  }
  return null
}

export function handleKey(win: BrowserWin, input: Electron.Input, source: 'chrome' | 'tab' | 'overlay', _wc?: WebContents): boolean {
  if (input.type !== 'keyDown' || input.meta) return false
  const id = resolveShortcut(input)
  if (!id) return false
  // Inside the omnibox, Ctrl+Backspace/Delete etc. are text editing; only
  // browser-level commands reach here, so the chrome needs no exceptions.
  void source
  if (id === 'find-next') return findStep(win, true), true
  if (id === 'find-prev') return findStep(win, false), true
  if (id.startsWith('goto-tab:')) {
    const n = Number(id.slice('goto-tab:'.length))
    const v = win.visibleTabs()
    const t = n === 9 ? v[v.length - 1] : v[n - 1]
    if (t) win.activate(t)
    return true
  }
  return runCommand(win, id) || true
}
