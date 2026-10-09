// The omnibox: what each keystroke suggests and what Enter does.
import { net } from 'electron'
import { BrowserWin } from './window'
import { ctx, settings } from './context'
import { SEARCH_ENGINES } from '../shared/settings'
import { displayUrl, hostOf, resolveInput, searchUrl } from '../shared/url'
import type { Rect, Suggestion } from '../shared/types'
import { logger } from './log'

const log = logger('omnibox')
const MAX = 8

interface State {
  text: string
  suggestions: Suggestion[]
  selected: number
  anchor: Rect
  remote: string[]
  remoteFor: string
  timer: NodeJS.Timeout | null
}

const states = new WeakMap<BrowserWin, State>()

function stateOf(win: BrowserWin): State {
  let s = states.get(win)
  if (!s) states.set(win, (s = { text: '', suggestions: [], selected: 0, anchor: { x: 0, y: 0, width: 400, height: 30 }, remote: [], remoteFor: '', timer: null }))
  return s
}

const favicon = (url: string) => ctx.favicons.get(hostOf(url))?.data ?? null

function build(win: BrowserWin, text: string, inline: string | null, remote: string[]): Suggestion[] {
  const engine = settings.get().searchEngine
  const out: Suggestion[] = []
  const seen = new Set<string>()
  const push = (s: Suggestion) => {
    if (seen.has(s.url) || out.length >= MAX) return
    seen.add(s.url)
    out.push(s)
  }
  const typed = text.trim()
  if (inline) {
    const completed = resolveInput(inline, engine)
    if (completed.kind === 'url') push({ kind: 'navigate', title: completed.url, url: completed.url, fill: inline, favicon: favicon(completed.url) })
  }
  const r = resolveInput(typed, engine)
  if (r.kind === 'url') push({ kind: 'navigate', title: displayUrl(r.url) || r.url, url: r.url, fill: typed, favicon: favicon(r.url) })
  else push({ kind: 'search', title: typed, url: r.url, fill: typed })

  // Open tabs, across every window of the same profile.
  const q = typed.toLowerCase()
  for (const w of BrowserWin.all.values()) {
    if (w.incognito !== win.incognito) continue
    for (const t of w.tabs) {
      if (t.closing || t === win.activeTab) continue
      const u = t.displayUrl()
      if (!/^https?:/.test(u)) continue
      if (t.title.toLowerCase().includes(q) || u.toLowerCase().includes(q)) {
        push({ kind: 'tab', title: t.title || u, url: u, fill: displayUrl(u), favicon: t.favicon, tabId: t.id })
        if (out.filter((s) => s.kind === 'tab').length >= 2) break
      }
    }
  }
  for (const b of ctx.bookmarks.search(typed, 3)) push({ kind: 'bookmark', title: b.title, url: b.url!, fill: displayUrl(b.url!), favicon: favicon(b.url!) })
  if (!win.incognito) for (const h of ctx.history.suggest(typed, 5)) push({ kind: 'history', title: h.title || displayUrl(h.url), url: h.url, fill: displayUrl(h.url), favicon: favicon(h.url) })
  for (const s of remote) {
    if (s.toLowerCase() === q) continue
    push({ kind: 'search', title: s, url: searchUrl(s, engine), fill: s })
  }
  return out
}

function show(win: BrowserWin): void {
  const s = stateOf(win)
  if (!s.suggestions.length || !s.text.trim()) {
    if (win.overlay.isOpen('omnibox')) win.overlay.hide()
    return
  }
  win.showOverlay(
    { content: { kind: 'omnibox', suggestions: s.suggestions, selected: s.selected, width: s.anchor.width }, anchor: s.anchor, align: 'start', passive: true },
    (id, payload) => {
      if (id === 'pick' && typeof payload === 'number') accept(win, s.text, payload, 'current')
    }
  )
}

export function omniboxInput(win: BrowserWin, text: string, anchor: Rect, allowInline: boolean): { inline: string | null } {
  const s = stateOf(win)
  s.text = text.slice(0, 2048)
  s.anchor = anchor
  s.selected = 0
  const typed = s.text.trim()
  if (!typed) {
    s.suggestions = []
    show(win)
    return { inline: null }
  }
  const inline = allowInline && !win.incognito ? ctx.history.inlineCompletion(typed) : null
  s.suggestions = build(win, s.text, inline, s.remoteFor && typed.startsWith(s.remoteFor.slice(0, 1)) ? s.remote.filter((r) => r.toLowerCase().startsWith(typed.toLowerCase())) : [])
  show(win)
  scheduleRemote(win)
  return { inline: inline && inline.toLowerCase().startsWith(typed.toLowerCase()) ? inline : null }
}

function scheduleRemote(win: BrowserWin): void {
  const s = stateOf(win)
  const st = settings.get()
  const endpoint = SEARCH_ENGINES[st.searchEngine].suggest
  if (s.timer) clearTimeout(s.timer)
  if (!st.searchSuggestions || !endpoint) return
  const text = s.text.trim()
  if (!text || /^[a-z]+:\/\//i.test(text) || text.length > 120) return
  s.timer = setTimeout(async () => {
    try {
      const res = await net.fetch(endpoint.replace('%s', encodeURIComponent(text)), { credentials: 'omit' } as RequestInit)
      const json = (await res.json()) as unknown
      const list = Array.isArray(json) && Array.isArray(json[1]) ? (json[1] as unknown[]).filter((x): x is string => typeof x === 'string') : []
      if (s.text.trim() !== text) return
      s.remote = list.slice(0, 6)
      s.remoteFor = text
      const sel = s.selected
      s.suggestions = build(win, s.text, null, s.remote)
      s.selected = Math.min(sel, s.suggestions.length - 1)
      if (win.overlay.isOpen('omnibox') || s.suggestions.length) show(win)
    } catch (err) {
      log.debug('suggest failed', err)
    }
  }, 140)
}

/** Arrow keys: move the selection, return what the field should show. */
export function omniboxMove(win: BrowserWin, delta: number): { fill: string; index: number } | null {
  const s = stateOf(win)
  if (!s.suggestions.length) return null
  s.selected = (s.selected + delta + s.suggestions.length) % s.suggestions.length
  show(win)
  const pick = s.suggestions[s.selected]
  return pick ? { fill: pick.fill, index: s.selected } : null
}

export function omniboxDismiss(win: BrowserWin): void {
  const s = stateOf(win)
  if (s.timer) clearTimeout(s.timer)
  s.suggestions = []
  if (win.overlay.isOpen('omnibox')) win.overlay.hide()
}

export function accept(win: BrowserWin, text: string, index: number | null, disposition: 'current' | 'newtab'): void {
  const s = stateOf(win)
  const pick = index != null && index >= 0 ? s.suggestions[index] : null
  omniboxDismiss(win)
  if (pick?.kind === 'tab' && pick.tabId != null) {
    for (const w of BrowserWin.all.values()) {
      const t = w.tabById(pick.tabId)
      if (t) {
        w.win.focus()
        w.activate(t)
        return
      }
    }
  }
  // An explicit pick (arrow keys or click) wins; otherwise do what the text says.
  const url = pick ? pick.url : resolveInput(text, settings.get().searchEngine).url
  const tab = win.activeTab
  if (disposition === 'newtab' || !tab) win.createTab({ url })
  else {
    tab.navigate(url, true)
    tab.wc?.focus()
  }
}
