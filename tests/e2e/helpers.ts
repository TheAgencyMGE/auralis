import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function tempProfile(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'auralis-e2e-'))
}

export interface Harness {
  app: ElectronApplication
  chrome: Page
  overlay: Page
  profile: string
  /** Main-process view of the first window. */
  state: () => Promise<{ tabs: { id: number; url: string; title: string; asleep: boolean }[]; active: number | null; overlay: string | null; split: unknown; spaces: number }>
  /** A real keystroke through Electron's native input path, delivered to the
   *  view that has focus (as the OS would), or to a specific one. */
  press: (target: 'focused' | 'chrome' | 'tab', key: string, modifiers?: string[]) => Promise<void>
  page: (prefix: string) => Promise<Page>
  close: () => Promise<void>
}

export async function launch(profile = tempProfile(), env: Record<string, string> = {}): Promise<Harness> {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, AURALIS_E2E: '1', AURALIS_USER_DATA: profile, ...env }
  })
  const page = async (prefix: string): Promise<Page> => {
    for (let i = 0; i < 100; i++) {
      const p = app.windows().find((w) => w.url().startsWith(prefix))
      if (p) return p
      await wait(100)
    }
    throw new Error(`no page starting with ${prefix}`)
  }
  const chrome = await page('auralis://chrome')
  const overlay = await page('auralis://overlay')
  await chrome.waitForSelector('.omnibox')
  const state: Harness['state'] = () =>
    app.evaluate(() => {
      const a = (globalThis as any).__auralis
      const w = [...a.BrowserWin.all.values()][0] as any
      return {
        tabs: w.visibleTabs().map((t: any) => ({ id: t.id, url: t.displayUrl(), title: t.title, asleep: !t.wc })),
        active: w.activeTab?.id ?? null,
        overlay: w.overlay.kind,
        split: w.split,
        spaces: w.spaces.length
      }
    })
  const press: Harness['press'] = (target, key, modifiers = []) =>
    app.evaluate(
      (_e, [target, key, modifiers]) => {
        const w = [...(globalThis as any).__auralis.BrowserWin.all.values()][0] as any
        const candidates = [w.overlay.view.webContents, w.chrome, ...w.tabs.map((t: any) => t.wc).filter(Boolean)]
        const wc = target === 'chrome' ? w.chrome : target === 'tab' ? w.activeTab.wc : (candidates.find((c: any) => c.isFocused()) ?? w.chrome)
        // Key-down only: a real key-up lands on whatever has focus by then,
        // which for popups is the overlay, not the view we pressed in.
        wc.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers })
      },
      [target, key, modifiers] as const
    )
  return { app, chrome, overlay, profile, state, press, page, close: () => app.close() }
}

/** Navigate the active tab the way a user does: through the omnibox. */
export async function omniboxGo(h: Harness, text: string): Promise<void> {
  const input = h.chrome.locator('.omnibox-input')
  await input.click()
  await input.fill(text)
  await input.press('Enter')
}

export async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeout = 8000): Promise<T> {
  const start = Date.now()
  let last: T
  do {
    last = await fn()
    if (ok(last)) return last
    await wait(120)
  } while (Date.now() - start < timeout)
  throw new Error(`condition not met; last value: ${JSON.stringify(last)}`)
}

// ---- fixture web server ------------------------------------------------------------

const article = Array.from({ length: 14 }, (_, i) => `<p>Paragraph ${i + 1}. The glass was cool under the morning light, and the water beyond the hills held the sky in it. ${'Aero design leaned on light, depth and translucency to make software feel alive. '.repeat(3)}</p>`).join('')

const routes: Record<string, (req: http.IncomingMessage, res: http.ServerResponse) => void> = {
  '/a': (_q, r) => html(r, 'Page A', '<h1>Alpha</h1><p>Find the word needle here, and needle again.</p><a id="tob" href="/b">to b</a>'),
  '/b': (_q, r) => html(r, 'Page B', '<h1>Beta</h1>'),
  '/c': (_q, r) => html(r, 'Page C', '<h1>Gamma</h1>'),
  '/popup': (_q, r) =>
    html(r, 'Opener', `<button id="open" onclick="window.w = window.open('/child', 'pop', 'width=400,height=300')">open</button>
      <script>window.addEventListener('message', (e) => { document.title = 'got ' + e.data })</script>`),
  '/child': (_q, r) => html(r, 'Child', `<script>window.opener && window.opener.postMessage('hello', '*')</script>`),
  '/slow': (_q, r) => {
    // The document arrives at once; an image keeps the page loading for a while.
    r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    r.end('<!doctype html><title>Slow</title><img src="/slow.png">')
  },
  '/slow.png': (_q, r) => void setTimeout(() => (r.writeHead(404), r.end()), 2500),
  '/autopop': (_q, r) => html(r, 'Auto pop', `<script>setTimeout(() => window.open('/child', 'ad', 'width=300,height=200'), 200)</script>`),
  '/feedpage': (_q, r) => {
    r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    r.end(`<!doctype html><html><head><title>Has a feed</title><link rel="alternate" type="application/rss+xml" title="Test feed" href="/rss"></head><body>news</body></html>`)
  },
  '/rss': (_q, r) => {
    r.writeHead(200, { 'Content-Type': 'application/rss+xml' })
    r.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>Test feed</title><link>http://example.com/</link><description>Items</description>
      <item><title>First &amp; foremost</title><link>http://example.com/1</link><pubDate>Tue, 30 Jan 2007 12:00:00 GMT</pubDate><description>&lt;b&gt;bold&lt;/b&gt; text&lt;script&gt;window.pwned=1&lt;/script&gt;</description></item>
      <item><title>Second</title><link>javascript:alert(1)</link></item>
      <item><title>Third</title><link>http://example.com/3</link></item></channel></rss>`)
  },
  '/tone.wav': (_q, r) => {
    const rate = 8000
    const n = rate * 20
    const b = Buffer.alloc(44 + n * 2)
    b.write('RIFF', 0)
    b.writeUInt32LE(36 + n * 2, 4)
    b.write('WAVEfmt ', 8)
    b.writeUInt32LE(16, 16)
    b.writeUInt16LE(1, 20)
    b.writeUInt16LE(1, 22)
    b.writeUInt32LE(rate, 24)
    b.writeUInt32LE(rate * 2, 28)
    b.writeUInt16LE(2, 32)
    b.writeUInt16LE(16, 34)
    b.write('data', 36)
    b.writeUInt32LE(n * 2, 40)
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 300), 44 + i * 2)
    r.writeHead(200, { 'Content-Type': 'audio/wav' })
    r.end(b)
  },
  '/media': (_q, r) => html(r, 'Media', `<script>navigator.mediaSession.metadata = new MediaMetadata({ title: 'Test Tone', artist: 'Auralis' })</script><audio id="a" src="/tone.wav" autoplay loop></audio>`),
  '/download': (_q, r) => {
    r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="auralis-test.bin"' })
    r.end(Buffer.alloc(64 * 1024, 7))
  },
  '/article': (_q, r) => html(r, 'A long read about glass', `<article><h1>A long read about glass</h1>${article}</article>`),
  '/geo': (_q, r) =>
    html(
      r,
      'Geo',
      `<button id="ask" onclick="navigator.geolocation.getCurrentPosition(() => document.title = 'geo ok', (e) => document.title = 'geo denied ' + e.code)">ask</button>`
    ),
  '/share': (_q, r) =>
    html(
      r,
      'Share',
      `<button id="share" onclick="navigator.mediaDevices.getDisplayMedia({ video: true }).then((s) => { document.title = 'shared ' + s.getVideoTracks().length; s.getTracks().forEach((t) => t.stop()) }, (e) => { document.title = 'share ' + e.name })">share</button>`
    ),
  '/hostile': (_q, r) =>
    html(
      r,
      'Hostile',
      `<script>
        window.result = { bridge: typeof window.auralis, node: typeof require, process: typeof process };
        document.title = 'checked';
      </script>
      <a id="int" href="auralis://settings/">settings</a>
      <iframe id="frame" src="auralis://settings/"></iframe>`
    )
}

function html(res: http.ServerResponse, title: string, body: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`)
}

export async function fixtureServer(): Promise<{ url: (p: string) => string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const route = routes[(req.url ?? '/').split('?')[0]]
    if (route) route(req, res)
    else {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  return { url: (p) => `http://127.0.0.1:${port}${p}`, close: () => new Promise((r) => server.close(() => r())) }
}
