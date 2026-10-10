// Built-in tools that replace common extensions.
import { app, dialog, nativeImage, net, shell, webContents } from 'electron'
import { copyPng } from './clip'
import fs from 'node:fs/promises'
import path from 'node:path'
import QRCode from 'qrcode'
import readabilitySource from '@mozilla/readability/Readability.js?raw'
import type { BrowserWin } from './window'
import type { Tab } from './tab'
import { ctx, settings } from './context'
import { shieldStats } from './shield'
import { SCHEME } from '../shared/url'
import type { ProcessRow, TabThumb } from '../shared/types'
import { logger } from './log'

const log = logger('tools')

// ---- reader view -------------------------------------------------------------

export interface Article {
  title: string
  byline: string | null
  siteName: string | null
  content: string
  excerpt: string | null
  length: number
  lang: string | null
  dir: string | null
  url: string
}

const articles = new Map<string, Article>()

export async function openReader(win: BrowserWin, tab: Tab): Promise<void> {
  const wc = tab.wc
  if (!wc || !/^https?:/.test(wc.getURL())) return
  try {
    // An isolated world: the page can neither see nor tamper with Readability.
    const result = (await wc.executeJavaScriptInIsolatedWorld(998, [
      {
        code: `${readabilitySource}
        ;(() => {
          const doc = document.cloneNode(true);
          const r = new Readability(doc, { charThreshold: 400 }).parse();
          return r ? { title: r.title, byline: r.byline, siteName: r.siteName, content: r.content, excerpt: r.excerpt,
                       length: r.length, lang: r.lang, dir: r.dir } : null;
        })()`
      }
    ])) as Omit<Article, 'url'> | null
    if (!result?.content) {
      win.toast('This page doesn’t have an article to read.')
      return
    }
    const id = Math.random().toString(36).slice(2, 12)
    articles.set(id, { ...result, url: wc.getURL() })
    if (articles.size > 30) articles.delete(articles.keys().next().value!)
    tab.navigate(`${SCHEME}://reader/?id=${id}`)
  } catch (err) {
    log.warn('reader failed', err)
    win.toast('Reader view couldn’t open this page.')
  }
}

export const getArticle = (id: string) => articles.get(id) ?? null

// ---- screenshots ---------------------------------------------------------------

export async function screenshot(win: BrowserWin, tab: Tab, mode: 'visible' | 'full'): Promise<void> {
  const wc = tab.wc
  if (!wc) return
  let png: Buffer
  try {
    if (mode === 'full') {
      const dbg = wc.debugger
      const attachedHere = !dbg.isAttached()
      if (attachedHere) dbg.attach('1.3')
      try {
        const metrics = (await dbg.sendCommand('Page.getLayoutMetrics')) as { cssContentSize: { width: number; height: number } }
        const width = Math.ceil(metrics.cssContentSize.width)
        const height = Math.min(Math.ceil(metrics.cssContentSize.height), 16000)
        const shot = (await dbg.sendCommand('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width, height, scale: 1 }
        })) as { data: string }
        png = Buffer.from(shot.data, 'base64')
      } finally {
        if (attachedHere) dbg.detach()
      }
    } else {
      png = (await wc.capturePage()).toPNG()
    }
  } catch (err) {
    log.warn('screenshot failed', err)
    win.toast('Couldn’t capture this page.')
    return
  }
  const dir = path.join(app.getPath('pictures'), 'Auralis Screenshots')
  await fs.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const host = (() => {
    try {
      return new URL(wc.getURL()).hostname.replace(/[^a-z0-9.-]/gi, '')
    } catch {
      return 'page'
    }
  })()
  const file = path.join(dir, `${host || 'page'} ${stamp}.png`)
  await fs.writeFile(file, png)
  copyPng(png)
  win.toast('Screenshot copied and saved to Pictures › Auralis Screenshots', 'camera')
  log.info('screenshot', file)
}

export function revealScreenshots(): void {
  void shell.openPath(path.join(app.getPath('pictures'), 'Auralis Screenshots'))
}

// ---- QR code ---------------------------------------------------------------------

export async function showQr(win: BrowserWin, tab: Tab): Promise<void> {
  const url = tab.displayUrl()
  if (!/^https?:/.test(url)) return
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 232, errorCorrectionLevel: 'M', color: { dark: '#0b3556', light: '#ffffff' } })
  const anchor = win.anchors.star ?? win.anchors.omnibox ?? { x: 400, y: 80, width: 0, height: 0 }
  win.showOverlay({ content: { kind: 'qr', url, dataUrl }, anchor, align: 'end' }, async (id) => {
    if (id === 'copy') copyPng(nativeImage.createFromDataURL(dataUrl).toPNG())
    if (id === 'save') {
      const r = await dialog.showSaveDialog(win.win, { defaultPath: path.join(app.getPath('downloads'), 'qr-code.png'), filters: [{ name: 'PNG image', extensions: ['png'] }] })
      if (!r.canceled && r.filePath) await fs.writeFile(r.filePath, nativeImage.createFromDataURL(dataUrl).toPNG())
    }
    win.overlay.hide()
  })
}

// ---- picture in picture --------------------------------------------------------------

export async function pictureInPicture(win: BrowserWin, tab: Tab): Promise<void> {
  const wc = tab.wc
  if (!wc) return
  try {
    const ok = await wc.executeJavaScript(
      `(async () => {
        if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return 'exit' }
        const vids = [...document.querySelectorAll('video')].filter(v => v.readyState > 0 && !v.disablePictureInPicture);
        vids.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
        const v = vids.find(v => !v.paused) || vids[0];
        if (!v) return 'none';
        await v.requestPictureInPicture();
        return 'ok';
      })()`,
      true
    )
    if (ok === 'none') win.toast('There’s no video on this page.')
  } catch (err) {
    log.warn('pip failed', err)
    win.toast('Picture-in-picture isn’t available for this video.')
  }
}

// ---- task manager -----------------------------------------------------------------------

export function processRows(wins: BrowserWin[]): ProcessRow[] {
  const metrics = app.getAppMetrics()
  const byPid = new Map(metrics.map((m) => [m.pid, m]))
  const rows: ProcessRow[] = []
  const claimed = new Set<number>()
  for (const w of wins) {
    for (const t of w.tabs) {
      if (t.closing) continue
      const wc = t.wc
      const pid = wc && !wc.isDestroyed() ? wc.getOSProcessId() : 0
      const m = pid ? byPid.get(pid) : undefined
      if (pid) claimed.add(pid)
      rows.push({
        pid,
        type: 'Tab',
        title: t.title || t.displayUrl(),
        url: t.displayUrl(),
        tabId: t.id,
        memoryKB: m?.memory.workingSetSize ?? 0,
        cpu: m?.cpu.percentCPUUsage ?? 0,
        asleep: !wc
      })
    }
  }
  const label: Record<string, string> = { Browser: 'Browser', GPU: 'GPU process', Utility: 'Utility', Tab: 'Interface' }
  for (const m of metrics) {
    if (claimed.has(m.pid)) continue
    let title = label[m.type] ?? m.type
    if (m.type === 'Utility' && m.serviceName) title = `Utility: ${m.name ?? m.serviceName}`
    if (m.type === 'Tab') {
      const wc = webContents.getAllWebContents().find((w) => !w.isDestroyed() && w.getOSProcessId() === m.pid)
      const url = wc?.getURL() ?? ''
      title = url.startsWith(`${SCHEME}://chrome`) ? 'Window frame' : url.startsWith(`${SCHEME}://overlay`) ? 'Menus & popovers' : 'Background page'
    }
    rows.push({ pid: m.pid, type: m.type, title, url: '', tabId: null, memoryKB: m.memory.workingSetSize, cpu: m.cpu.percentCPUUsage, asleep: false })
  }
  return rows
}

export function meter(wins: BrowserWin[]) {
  const metrics = app.getAppMetrics()
  const memoryKB = metrics.reduce((a, m) => a + m.memory.workingSetSize, 0)
  const cpu = metrics.reduce((a, m) => a + m.cpu.percentCPUUsage, 0)
  const tabs = wins.flatMap((w) => w.tabs).filter((t) => !t.closing)
  return {
    memoryMB: Math.round(memoryKB / 1024),
    cpu: Math.round(cpu * 10) / 10,
    tabs: tabs.length,
    sleeping: tabs.filter((t) => !t.wc).length,
    blocked: shieldStats().totalBlocked
  }
}

// ---- thumbnails for Tab Flip / previews ---------------------------------------------------

export async function thumbsFor(win: BrowserWin, allSpaces = false): Promise<TabThumb[]> {
  const active = win.activeTab
  if (active) await active.captureThumbnail()
  return win.tabs
    .filter((t) => !t.closing && (allSpaces || t.spaceId === win.activeSpaceId))
    .map((t) => ({
      id: t.id,
      title: t.title || t.displayUrl(),
      url: t.displayUrl(),
      favicon: t.favicon,
      thumbnail: t.thumbnail,
      asleep: !t.wc,
      active: t === active,
      spaceId: t.spaceId
    }))
}

// ---- weather (Open-Meteo, CC BY 4.0) ----------------------------------------------------------

const weatherCache = new Map<string, { at: number; data: unknown }>()

export async function weather(): Promise<unknown> {
  const loc = settings.get().weatherLocation
  if (!loc) return { needsLocation: true }
  const unit = settings.get().temperatureUnit
  const key = `${loc.lat},${loc.lon},${unit}`
  const hit = weatherCache.get(key)
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.data
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=5` +
    (unit === 'f' ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : '')
  try {
    const res = await net.fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = { location: loc.name, unit, ...((await res.json()) as object) }
    weatherCache.set(key, { at: Date.now(), data })
    return data
  } catch (err) {
    log.warn('weather failed', err)
    return hit?.data ?? { error: 'offline' }
  }
}

export async function geocode(query: string): Promise<{ name: string; lat: number; lon: number }[]> {
  const q = query.trim().slice(0, 80)
  if (q.length < 2) return []
  try {
    const res = await net.fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&format=json&name=${encodeURIComponent(q)}`)
    const json = (await res.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] }
    return (json.results ?? []).map((r) => ({
      name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      lat: r.latitude,
      lon: r.longitude
    }))
  } catch {
    return []
  }
}

export function topSites(limit = 8) {
  return ctx.history.topSites(limit).map((e) => {
    const host = (() => {
      try {
        return new URL(e.url).hostname
      } catch {
        return ''
      }
    })()
    const icon = ctx.favicons.get(host)
    return { ...e, favicon: icon?.data ?? null, accent: icon?.accent ?? null, host: host.replace(/^www\./, '') }
  })
}

// ---- feeds (RSS/Atom) and currency rates ----------------------------------------------------------

const feedCache = new Map<string, { at: number; text: string }>()
const FEED_MAX = 3 * 1024 * 1024

/** Fetch a feed as text for the renderer to parse (DOMParser, text only).
 *  No cookies are sent: a feed is public, and this keeps it from being a
 *  way to read logged-in pages. */
export async function fetchFeed(ses: Electron.Session, url: string): Promise<{ text: string; url: string } | { error: string }> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { error: 'That isn’t a valid feed address.' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'Only web feeds can be shown.' }
  const hit = feedCache.get(u.href)
  if (hit && Date.now() - hit.at < 10 * 60_000) return { text: hit.text, url: u.href }
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 12_000)
    const res = await ses.fetch(u.href, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal, headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1' } } as RequestInit)
    clearTimeout(timer)
    if (!res.ok) return { error: `The feed server answered ${res.status}.` }
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > FEED_MAX) return { error: 'This feed is too large to show.' }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > FEED_MAX) return { error: 'This feed is too large to show.' }
    const text = buf.toString('utf8')
    feedCache.set(u.href, { at: Date.now(), text })
    if (feedCache.size > 20) feedCache.delete(feedCache.keys().next().value!)
    return { text, url: res.url || u.href }
  } catch (err) {
    log.warn('feed failed', u.href, err)
    return hit ? { text: hit.text, url: u.href } : { error: 'Auralis couldn’t reach this feed. Check your connection.' }
  }
}

const rateCache = new Map<string, { at: number; data: unknown }>()

/** ECB reference rates via Frankfurter (no key, no tracking). */
export async function currencyRates(base: string, quotes: string[]): Promise<unknown> {
  const key = `${base}:${quotes.join(',')}`
  const hit = rateCache.get(key)
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.data
  try {
    const res = await net.fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quotes.join(',')}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { base: string; date: string; rates: Record<string, number> }
    const data = { base: json.base, date: json.date, rates: json.rates }
    rateCache.set(key, { at: Date.now(), data })
    return data
  } catch (err) {
    log.warn('rates failed', err)
    return hit?.data ?? { error: 'offline' }
  }
}
