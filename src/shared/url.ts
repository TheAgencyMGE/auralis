// URL handling shared by the omnibox, navigation guards and tests.
// Everything here is pure so it can be unit-tested without Electron.

import { SEARCH_ENGINES, type SearchEngineId } from './settings'

export const SCHEME = 'auralis'

/** Internal pages a tab may show. The chrome and overlay hosts are not listed:
 *  they must never be loaded into a tab. */
export const INTERNAL_PAGES = [
  'newtab',
  'settings',
  'history',
  'bookmarks',
  'downloads',
  'taskmanager',
  'reader',
  'error',
  'about',
  'welcome',
  'feed',
  'extensions'
] as const
export type InternalPage = (typeof INTERNAL_PAGES)[number]

export const UI_HOSTS = ['chrome', 'overlay'] as const

export const NEW_TAB_URL = 'auralis://newtab/'

export function internalPage(url: string): InternalPage | null {
  try {
    const u = new URL(url)
    if (u.protocol !== `${SCHEME}:`) return null
    return (INTERNAL_PAGES as readonly string[]).includes(u.hostname) ? (u.hostname as InternalPage) : null
  } catch {
    return null
  }
}

/** auralis://settings → auralis://settings/ (Node parses custom schemes as
 *  non-special; Chromium treats ours as standard and always adds the slash). */
export function normalizeInternal(url: string): string {
  const u = new URL(url)
  return `${SCHEME}://${u.hostname}${u.pathname || '/'}${u.search}${u.hash}`
}

export function isInternalUrl(url: string): boolean {
  return url.startsWith(`${SCHEME}:`)
}

/** Schemes a tab may navigate to. Anything else is handed to the OS (after
 *  confirmation) or dropped. */
export const WEB_SCHEMES = new Set(['http:', 'https:', 'file:', `${SCHEME}:`, 'about:', 'data:', 'blob:', 'view-source:', 'chrome-extension:'])

/** Schemes that may be passed to shell.openExternal after the user confirms. */
export const EXTERNAL_SCHEMES = new Set(['mailto:', 'tel:', 'sms:', 'callto:', 'magnet:', 'ms-settings:', 'zoommtg:', 'msteams:', 'slack:', 'spotify:', 'steam:', 'discord:', 'webcal:'])

const HOST_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

function looksLikeHost(host: string): boolean {
  if (host === 'localhost') return true
  if (IPV4.test(host)) return true
  if (host.startsWith('[') && host.endsWith(']')) return true
  const labels = host.split('.')
  if (labels.length < 2) return false
  if (!labels.every((l) => HOST_LABEL.test(l) || /^xn--/.test(l))) return false
  const tld = labels[labels.length - 1]
  return /^[a-z]{2,63}$/i.test(tld) || /^xn--[a-z0-9-]+$/i.test(tld)
}

export function searchUrl(query: string, engine: SearchEngineId): string {
  return SEARCH_ENGINES[engine].search.replace('%s', encodeURIComponent(query.trim()))
}

export type ResolvedInput = { kind: 'url'; url: string } | { kind: 'search'; url: string; query: string }

/**
 * Turn whatever the user typed into the omnibox into a navigation target.
 * Rules, in order: explicit allowed schemes, about: aliases for internal
 * pages, host[:port][/path] that looks like a real host, otherwise a search.
 */
export function resolveInput(raw: string, engine: SearchEngineId): ResolvedInput {
  const text = raw.trim()
  const search = (): ResolvedInput => ({ kind: 'search', url: searchUrl(text, engine), query: text })
  if (!text) return search()

  // about:settings → auralis://settings (familiar spelling)
  const about = /^about:([a-z]+)\/?$/i.exec(text)
  if (about && (INTERNAL_PAGES as readonly string[]).includes(about[1].toLowerCase())) {
    return { kind: 'url', url: `${SCHEME}://${about[1].toLowerCase()}/` }
  }
  if (/^about:blank$/i.test(text)) return { kind: 'url', url: 'about:blank' }

  // Windows paths: C:\Users\me\file.html (checked before schemes: "C:" looks like one)
  if (/^[a-z]:[\\/]/i.test(text)) {
    const [drive, ...rest] = text.replace(/\\/g, '/').split('/')
    return { kind: 'url', url: 'file:///' + [drive, ...rest.map(encodeURIComponent)].join('/') }
  }

  if (/\s/.test(text) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return search()

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text)?.[1]?.toLowerCase()
  if (scheme) {
    if (scheme === 'http' || scheme === 'https' || scheme === 'file') {
      try {
        return { kind: 'url', url: new URL(text).href }
      } catch {
        return search()
      }
    }
    if (scheme === SCHEME) {
      return internalPage(text) ? { kind: 'url', url: normalizeInternal(text) } : search()
    }
    if (scheme === 'view-source') {
      const inner = text.slice('view-source:'.length)
      if (/^https?:\/\//i.test(inner)) {
        try {
          return { kind: 'url', url: `view-source:${new URL(inner).href}` }
        } catch {
          return search()
        }
      }
      return search()
    }
    // "localhost:3000" and "example.com:8080/x" parse as a scheme; fall through.
    if (!/^[a-z0-9.-]+:\d+/i.test(text)) {
      // javascript:, data:, vbscript: and friends are never navigated to from
      // the omnibox: pasting them is a classic self-XSS lure.
      return search()
    }
  }

  const m = /^([^/?#]+)([/?#].*)?$/.exec(text)
  if (m) {
    const hostPort = m[1]
    const host = hostPort.replace(/:\d{1,5}$/, '').toLowerCase()
    if (looksLikeHost(host)) {
      const local = host === 'localhost' || IPV4.test(host) || host.startsWith('[') || host.endsWith('.localhost') || host.endsWith('.test')
      try {
        return { kind: 'url', url: new URL(`${local ? 'http' : 'https'}://${text}`).href }
      } catch {
        return search()
      }
    }
  }
  return search()
}

/** What the omnibox shows when it is not focused. */
export function displayUrl(url: string): string {
  if (!url || url === 'about:blank') return ''
  if (url.startsWith(NEW_TAB_URL)) return ''
  try {
    const u = new URL(url)
    if (u.protocol === 'https:' || u.protocol === 'http:') {
      let s = u.host + (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash
      if (u.protocol === 'http:') s = 'http://' + s
      return safeDecode(s)
    }
    return url
  } catch {
    return url
  }
}

function safeDecode(s: string): string {
  try {
    // Never decode characters that could disguise the URL (spaces, slashes, control chars).
    return decodeURI(s).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, (c) => encodeURIComponent(c))
  } catch {
    return s
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export function originOf(url: string): string {
  try {
    const u = new URL(url)
    return u.origin === 'null' ? `${u.protocol}//${u.host}` : u.origin
  } catch {
    return ''
  }
}

/** Registrable-ish site key used for per-site settings (shield allowlist). */
export function siteKey(url: string): string {
  const h = hostOf(url).toLowerCase()
  return h.startsWith('www.') ? h.slice(4) : h
}

export function securityOf(url: string, certError = false): import('./types').SecurityLevel {
  if (certError) return 'error'
  if (url.startsWith(`${SCHEME}:`)) return 'internal'
  if (url.startsWith('https:')) return 'secure'
  if (url.startsWith('http:')) {
    const h = hostOf(url)
    // Local development servers: no lock (it isn't encrypted) but no alarm either.
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost') ? 'none' : 'insecure'
  }
  if (url.startsWith('file:')) return 'file'
  return 'none'
}

/** Escape text for inclusion in HTML generated by the main process. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
