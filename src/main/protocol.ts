// The auralis:// scheme. Serves the chrome, the overlay and internal pages
// from the built renderer bundle (or proxies the Vite dev server in
// development so origins, CSP and preload checks behave identically).
import { app, protocol, type Session } from 'electron'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { userWallpaperPath } from './wallpapers'
import { INTERNAL_PAGES, SCHEME, UI_HOSTS } from '../shared/url'
import { logger } from './log'

const log = logger('protocol')
const DEV_URL = process.env['ELECTRON_RENDERER_URL']

export function registerSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true, stream: true }
    }
  ])
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
}

function entryFor(host: string): string | null {
  if (host === 'chrome' || host === 'overlay') return `${host}/index.html`
  if ((INTERNAL_PAGES as readonly string[]).includes(host)) return 'page/index.html'
  return null
}

function csp(host: string): string {
  const dev = !!DEV_URL
  const img = host === 'reader' ? "'self' data: blob: https:" : "'self' data: blob:"
  return [
    "default-src 'self'",
    `script-src 'self'${dev ? " 'unsafe-inline' http://localhost:*" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img}`,
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws://localhost:* http://localhost:*' : ''}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    // The overlay and chrome are never framed; internal pages never either.
    "frame-ancestors 'none'"
  ].join('; ')
}

const rendererRoot = () => path.join(app.getAppPath(), 'out', 'renderer')

const STREAMED = new Set(['.mp4', '.m4v', '.webm', '.mov', '.ogv'])

/** Serve a file from disk, honouring Range so video plays and seeks without
 *  ever reading the whole file into memory. */
async function serveFile(file: string, request: Request, headers: Record<string, string>): Promise<Response> {
  let size: number
  try {
    const st = await fs.stat(file)
    if (!st.isFile()) throw new Error('not a file')
    size = st.size
  } catch {
    return new Response('Not found', { status: 404 })
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  const base = { ...headers, 'Content-Type': type, 'Accept-Ranges': 'bytes' }
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '')
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } })
    start = Math.max(0, start)
    end = Math.max(start, end)
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
    return new Response(body, { status: 206, headers: { ...base, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}` } })
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream
  return new Response(body, { status: 200, headers: { ...base, 'Content-Length': String(size) } })
}

async function handle(request: Request): Promise<Response> {
  let url: URL
  try {
    url = new URL(request.url)
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const host = url.hostname
  if (!(INTERNAL_PAGES as readonly string[]).includes(host) && !(UI_HOSTS as readonly string[]).includes(host)) {
    return new Response('Not found', { status: 404 })
  }
  // Web content may not load anything from auralis:// (fingerprinting, clickjacking).
  const referrer = request.referrer
  if (referrer && !referrer.startsWith(`${SCHEME}:`) && referrer !== 'about:client') {
    log.warn('blocked cross-origin request', request.url, 'from', referrer)
    return new Response('Forbidden', { status: 403 })
  }

  const isDocument = url.pathname === '/' || url.pathname === '/index.html' || !path.extname(url.pathname)
  const rel = isDocument ? entryFor(host)! : decodeURIComponent(url.pathname).replace(/^\/+/, '')
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cache-Control': isDocument ? 'no-store' : 'max-age=31536000, immutable'
  }
  if (isDocument) {
    headers['Content-Security-Policy'] = csp(host)
    headers['X-Frame-Options'] = 'DENY'
    headers['Referrer-Policy'] = 'no-referrer'
  }

  // The user's own wallpapers live in the profile, not the app bundle.
  if (rel.startsWith('user-wallpapers/')) {
    const file = userWallpaperPath(rel.slice('user-wallpapers/'.length))
    if (!file) return new Response('Not found', { status: 404 })
    return serveFile(file, request, { ...headers, 'Cache-Control': 'no-cache' })
  }

  if (DEV_URL) {
    try {
      const upstream = await fetch(new URL(rel, DEV_URL.endsWith('/') ? DEV_URL : DEV_URL + '/'))
      const body = await upstream.arrayBuffer()
      const type = upstream.headers.get('content-type') ?? MIME[path.extname(rel)] ?? 'application/octet-stream'
      return new Response(body, { status: upstream.status, headers: { ...headers, 'Content-Type': type, 'Cache-Control': 'no-store' } })
    } catch (err) {
      log.error('dev proxy failed', rel, err)
      return new Response('Dev server unavailable', { status: 502 })
    }
  }

  const root = rendererRoot()
  const file = path.resolve(root, rel)
  if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 })
  if (STREAMED.has(path.extname(file).toLowerCase())) return serveFile(file, request, headers)
  try {
    const body = await fs.readFile(file)
    return new Response(body, { headers: { ...headers, 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}

const installed = new WeakSet<Session>()

export function installProtocol(ses: Session): void {
  if (installed.has(ses)) return
  installed.add(ses)
  ses.protocol.handle(SCHEME, handle)
}

export function uiUrl(host: 'chrome' | 'overlay'): string {
  return `${SCHEME}://${host}/`
}
