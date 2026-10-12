// Visual exploration: drives Auralis through real flows and captures what
// the screen shows (acrylic and composited views included).
// Usage: node tests/e2e/explore.mjs <profileDir> <outDir> [scenario]
import { _electron as electron } from 'playwright'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'

const [profile, outDir, scenario = 'basic'] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const app = await electron.launch({ args: ['.', ...(process.env.EXTRA_ARGS ? process.env.EXTRA_ARGS.split(' ') : [])], env: { ...process.env, AURALIS_E2E: '1', AURALIS_USER_DATA: profile } })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (name) => {
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/shot.ps1', '-Out', path.join(outDir, `${name}.png`), '-Title', 'Auralis E2E'], { stdio: 'inherit' })
}
const page = async (prefix) => {
  for (let i = 0; i < 50; i++) {
    const p = app.windows().find((w) => w.url().startsWith(prefix))
    if (p) return p
    await wait(100)
  }
  throw new Error('no page ' + prefix)
}
await wait(2500)
// A unique title so screenshots never pick up another Auralis window.
await app.evaluate(() => [...globalThis.__auralis.BrowserWin.all.values()].forEach((w) => w.win.setTitle('Auralis E2E')))
const chrome = await page('auralis://chrome')
const overlay = await page('auralis://overlay')

async function go(url) {
  await chrome.keyboard.press('Control+L')
  await chrome.keyboard.type(url)
  await chrome.keyboard.press('Enter')
  await wait(3500)
}

try {
  if (scenario === 'basic') {
    await go('en.wikipedia.org/wiki/Frutiger_Aero')
    shot('wiki')
    await chrome.keyboard.press('Control+L')
    await chrome.keyboard.type('wiki')
    await wait(1200)
    shot('omnibox')
    await chrome.keyboard.press('Escape')
    await chrome.keyboard.press('Escape')
    await chrome.click('.aq-orb, .orb-button')
    await wait(800)
    shot('appmenu')
    await overlay.keyboard.press('Escape')
    await wait(300)
    await chrome.keyboard.press('Control+T')
    await wait(800)
    await go('github.com')
    await chrome.hover('.tab >> nth=0')
    await wait(1400)
    shot('preview')
    await chrome.mouse.move(600, 600)
    await chrome.click('.shield-btn')
    await wait(900)
    shot('siteinfo')
    await overlay.keyboard.press('Escape')
    await chrome.keyboard.press('Control+Shift+A')
    await wait(1200)
    shot('tabflip')
    await overlay.keyboard.press('Escape')
    await chrome.keyboard.press('Control+Shift+E')
    await wait(1500)
    shot('split')
  }
  if (scenario === 'tour') {
    const run = (id) => app.evaluate((_e, id) => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; a.runCommand(w, id) }, id)
    const W = (fn, arg) => app.evaluate(fn, arg)
    await go('en.wikipedia.org/wiki/Windows_Vista')
    await chrome.keyboard.press('Control+L')
    await go('news.ycombinator.com')
    await go('github.com/electron/electron')
    await W(() => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; for (const u of ['https://en.wikipedia.org/wiki/Frutiger_Aero', 'https://www.bbc.com/news', 'https://developer.mozilla.org/en-US/', 'https://www.youtube.com/']) w.createTab({ url: u }, { activate: false }) })
    await wait(5000)
    shot('t1-tabs')
    for (const page of ['settings', 'history', 'bookmarks', 'downloads', 'taskmanager', 'about']) {
      await W((_e, p) => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('auralis://' + p + '/') }, page)
      await wait(1500)
      shot('t2-' + page)
    }
    await W(() => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('https://en.wikipedia.org/wiki/Aurora') })
    await wait(3000)
    await run('tab-flip'); await wait(1500); shot('t3-flip'); await overlay.keyboard.press('Escape'); await wait(400)
    await run('split-view'); await wait(2500); shot('t4-split'); await run('split-view'); await wait(500)
    await run('palette'); await wait(800); await overlay.keyboard.type('scr'); await wait(500); shot('t5-palette'); await overlay.keyboard.press('Escape'); await wait(300)
    await run('reader'); await wait(2500); shot('t6-reader')
    await W(() => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('http://127.0.0.1:9/') }); await wait(2000); shot('t7-error')
    await run('new-private'); await wait(2500); shot('t8-private')
  }
  if (scenario === 'look') {
    const W = (fn, arg) => app.evaluate(fn, arg)
    const run = (id) => app.evaluate((_e, id) => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; a.runCommand(w, id) }, id)
    await W(() => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('https://en.wikipedia.org/wiki/Aero_(design_language)'); for (const u of ['https://www.youtube.com/', 'https://github.com/']) w.createTab({ url: u }, { activate: false }) })
    await wait(5000)
    shot('l1-wiki')
    await W(() => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.createTab({ url: 'auralis://newtab/' }) })
    await wait(2000)
    shot('l2-ntp')
    await W(() => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('auralis://settings/') })
    await wait(1500)
    shot('l3-settings')
    await run('new-private'); await wait(2500); shot('l4-private')
  }
  if (scenario === 'dpi') {
    await app.evaluate(() => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.win.setBounds({ x: 40, y: 40, width: 1000, height: 640 }); w.activeTab.navigate('https://en.wikipedia.org/wiki/Glass') })
    await wait(4000)
    shot('dpi')
    const geo = await app.evaluate(({ screen }) => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; return { view: w.activeTab.view.getBounds(), vp: w.viewport, content: w.win.getContentSize(), scale: screen.getPrimaryDisplay().scaleFactor } })
    console.log(JSON.stringify(geo))
  }
  if (scenario === 'aero') {
    for (const wp of ['reef', 'meadow', 'grass', 'koi']) {
      await app.evaluate((_e, wp) => { const a = globalThis.__auralis; a.settings.set({ wallpaper: wp, weatherLocation: { name: 'Honolulu, Hawaii, United States', lat: 21.3, lon: -157.85 } }); const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('auralis://newtab/') }, wp)
      await wait(3500)
      shot('aero-' + wp)
    }
    await app.evaluate(() => { const a = globalThis.__auralis; a.settings.set({ widgets: { weather: false, notes: false, aquarium: false, meter: false } }) })
    await wait(1500)
    shot('aero-nogadgets')
    await app.evaluate(() => { const a = globalThis.__auralis; a.settings.set({ widgets: { weather: true, notes: true, aquarium: true } }); const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('auralis://settings/') })
    await wait(1500)
    shot('aero-settings')
  }
  if (scenario === 'real') {
    const W = (fn, arg) => app.evaluate(fn, arg)
    await W(() => { const a = globalThis.__auralis; a.settings.set({ wallpaper: 'lagoon', widgets: { meter: true }, weatherLocation: { name: 'Honolulu, Hawaii, United States', lat: 21.3, lon: -157.85 } }); const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('auralis://newtab/') })
    await wait(3500)
    shot('r1-ntp')
    await W(() => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('https://en.wikipedia.org/wiki/Frutiger_Aero') })
    await wait(3500)
    await chrome.click('.aq-orb, .orb-button')
    await wait(900)
    shot('r2-menu')
    await overlay.keyboard.press('Escape')
    for (const pg of ['history', 'about']) {
      await W((_e, p) => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('auralis://' + p + '/') }, pg)
      await wait(1500)
      shot('r3-' + pg)
    }
    await W(() => { const a = globalThis.__auralis; const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('http://127.0.0.1:9/') })
    await wait(2000)
    shot('r4-error')
  }
  if (scenario === 'live') {
    for (const wp of ['live:fields', 'live:bubbles', 'live:dolphins', 'live:koi', 'live:jellyfish', 'live:borealis']) {
      await app.evaluate((_e, wp) => { const a = globalThis.__auralis; a.settings.set({ wallpaper: wp, widgets: { aquarium: true }, weatherLocation: { name: 'Honolulu, Hawaii, United States', lat: 21.3, lon: -157.85 } }); const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('auralis://newtab/') }, wp)
      await wait(3000)
      const ntp = app.windows().find((w) => w.url().startsWith('auralis://newtab'))
      const t1 = await ntp.evaluate(() => [...document.querySelectorAll('video')].map((v) => +v.currentTime.toFixed(2)))
      await wait(1500)
      const t2 = await ntp.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ t: +v.currentTime.toFixed(2), paused: v.paused, err: v.error && v.error.code, w: v.videoWidth })))
      console.log(wp, JSON.stringify(t1), JSON.stringify(t2))
      shot('live-' + wp.slice(5))
    }
  }
  if (scenario === 'loop') {
    await app.evaluate(() => { const a = globalThis.__auralis; a.settings.set({ wallpaper: 'live:borealis' }); const w = [...a.BrowserWin.all.values()][0]; w.activeTab.navigate('auralis://newtab/') })
    await wait(2000)
    const ntp = app.windows().find((w) => w.url().startsWith('auralis://newtab'))
    for (let i = 0; i < 6; i++) {
      console.log(JSON.stringify(await ntp.evaluate(() => { const v = document.querySelector('video.ntp-live'); return { t: +v.currentTime.toFixed(2), dur: +v.duration.toFixed(2), ended: v.ended, paused: v.paused } })))
      await wait(2000)
    }
    await ntp.click('text=Wallpaper')
    await wait(800)
    shot('picker')
  }
  if (scenario === 'more') {
    // A local site with a feed, a sound, a scripted pop-up and a download.
    const wav = (() => {
      const rate = 8000, secs = 30, n = rate * secs, b = Buffer.alloc(44 + n * 2)
      b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
      b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40)
      for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 600), 44 + i * 2)
      return b
    })()
    const server = http.createServer((req, res) => {
      const html = (t, body) => (res.writeHead(200, { 'content-type': 'text/html' }), res.end(`<!doctype html><title>${t}</title>${body}`))
      if (req.url === '/tone.wav') return res.writeHead(200, { 'content-type': 'audio/wav' }), res.end(wav)
      if (req.url === '/file.zip') return res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="photos-2009.zip"' }), res.end(Buffer.alloc(4096))
      if (req.url === '/rss') return res.writeHead(200, { 'content-type': 'application/rss+xml' }), res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>Aero Times</title><link>http://127.0.0.1/</link><description>News from the glass age</description>${['Windows Vista ships to consumers', 'Zune gets a firmware update', 'Frutiger Aero returns', 'Sidebar gadgets gallery opens', 'IE7 adds tabs and feeds'].map((t, i) => `<item><title>${t}</title><link>http://127.0.0.1/a${i}</link><pubDate>${new Date(Date.UTC(2007, 0, 30 - i)).toUTCString()}</pubDate><description>&lt;p&gt;Story ${i + 1}: ${t}.&lt;/p&gt;</description></item>`).join('')}</channel></rss>`)
      if (req.url === '/media') return html('Radio', `<script>navigator.mediaSession.metadata = new MediaMetadata({ title: 'Sunrise over the bay', artist: 'Aero FM' })</script><audio src="/tone.wav" autoplay loop controls></audio>`)
      if (req.url === '/popup') return html('Pop-up page', `<p>This page opens a pop-up by itself.</p><script>setTimeout(() => window.open('/rss', 'ad', 'width=300,height=200'), 400)</script>`)
      return html('Aero Times', `<link rel="alternate" type="application/rss+xml" title="Aero Times" href="/rss"><h1>Aero Times</h1><p>Glass, gloss and grass.</p>`)
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    const base = `http://127.0.0.1:${server.address().port}`
    const W = (fn, arg) => app.evaluate(fn, arg)
    const nav = (url) => W((_e, u) => { const w = [...globalThis.__auralis.BrowserWin.all.values()][0]; w.activeTab.navigate(u) }, url)
    // splash
    // The splash lasts under two seconds; hold it still for the (slow) screenshot.
    await W(() => { const w = [...globalThis.__auralis.BrowserWin.all.values()][0]; w.showOverlay({ content: { kind: 'splash' }, anchor: { x: 0, y: 0, width: 0, height: 0 }, align: 'center', modal: true, passive: true }) })
    await wait(800)
    await overlay.evaluate(() => document.querySelectorAll('.ov-modal, .splash').forEach((e) => (e.style.animation = 'none')))
    shot('m01-splash')
    await W(() => [...globalThis.__auralis.BrowserWin.all.values()][0].overlay.hide())
    if (process.env.ONLY_SPLASH) throw new Error('done')
    if (process.env.ONLY_FLIP) {
      await W(() => { const w = [...globalThis.__auralis.BrowserWin.all.values()][0]; for (const u of ['https://en.wikipedia.org/wiki/Frutiger_Aero', 'https://en.wikipedia.org/wiki/Windows_Vista', 'https://example.com/', 'auralis://newtab/']) w.createTab({ url: u }, { activate: true }) })
      await wait(5000)
      await W(() => { const a = globalThis.__auralis; a.runCommand([...a.BrowserWin.all.values()][0], 'flip-3d') })
      await wait(1500)
      shot('m09-flip3d')
      await overlay.keyboard.press('ArrowDown')
      await wait(800)
      shot('m10-flip3d-next')
      throw new Error('done')
    }
    // welcome
    await nav('auralis://welcome/')
    await wait(1500)
    shot('m02-welcome')
    // new tab with every gadget and a new live wallpaper
    await W(() => globalThis.__auralis.settings.set({ wallpaper: 'live:rain', widgets: { analogClock: true, slideshow: true, news: true, currency: true, meter: false, notes: false, aquarium: false }, newsFeed: 'https://feeds.bbci.co.uk/news/rss.xml', weatherLocation: { name: 'Honolulu, Hawaii, United States', lat: 21.3, lon: -157.85 } }))
    await nav('auralis://newtab/')
    await wait(4000)
    shot('m03-ntp')
    // feed detection and the feed view
    await nav(base + '/')
    await wait(1500)
    await W(() => [...globalThis.__auralis.BrowserWin.all.values()][0].activeTab.wc.focus())
    await wait(600)
    shot('m04-feedbutton')
    await chrome.click('.feed-btn', { timeout: 5000 })
    await wait(1500)
    shot('m05-feedview')
    // sidebar beside a page, with the mini player playing
    await W(() => globalThis.__auralis.settings.set({ sidebar: true, widgets: { aquarium: true, notes: true } }))
    await nav(base + '/media')
    await wait(2500)
    shot('m06-sidebar-player')
    console.log('media', JSON.stringify(await W(() => [...globalThis.__auralis.BrowserWin.all.values()][0].state().tabs.map((t) => t.media))))
    await W(() => globalThis.__auralis.settings.set({ sidebar: false }))
    // pop-up blocked
    await nav(base + '/popup')
    await wait(1800)
    shot('m07-popup')
    // download finished
    await nav(base + '/file.zip')
    await wait(2000)
    shot('m08-download')
    // Flip 3D over several tabs
    await W((_e, b) => { const w = [...globalThis.__auralis.BrowserWin.all.values()][0]; for (const u of ['https://en.wikipedia.org/wiki/Frutiger_Aero', 'https://en.wikipedia.org/wiki/Windows_Vista', b + '/', 'auralis://newtab/']) w.createTab({ url: u }, { activate: true }) }, base)
    await wait(5000)
    await W(() => { const a = globalThis.__auralis; a.runCommand([...a.BrowserWin.all.values()][0], 'flip-3d') })
    await wait(1500)
    shot('m09-flip3d')
    await overlay.keyboard.press('ArrowDown')
    await wait(700)
    shot('m10-flip3d-next')
    await overlay.keyboard.press('Escape')
    // Aero Basic
    await W(() => globalThis.__auralis.settings.set({ transparency: false }))
    await wait(1200)
    shot('m11-basic')
    await W(() => globalThis.__auralis.settings.set({ transparency: true }))
    server.close()
  }
  if (scenario === 'aqua') {
    const W = (fn, arg) => app.evaluate(fn, arg)
    const win = () => [...globalThis.__auralis.BrowserWin.all.values()][0]
    await W(() => globalThis.__auralis.settings.set({ wallpaper: 'live:fields', weatherLocation: { name: 'Honolulu, Hawaii, United States', lat: 21.3, lon: -157.85 } }))
    // Visit a few sites so the new tab page has channels.
    for (const u of ['https://en.wikipedia.org/wiki/Frutiger_Aero?banner=none', 'https://www.bbc.com/news', 'https://developer.mozilla.org/en-US/', 'https://github.com/']) {
      await W((_e, u) => [...globalThis.__auralis.BrowserWin.all.values()][0].activeTab.navigate(u), u)
      await wait(2500)
    }
    await W(() => {
      const w = [...globalThis.__auralis.BrowserWin.all.values()][0]
      for (const u of ['https://en.wikipedia.org/wiki/Windows_Vista?banner=none', 'https://en.wikipedia.org/wiki/Wii?banner=none', 'https://www.youtube.com/']) w.createTab({ url: u }, { activate: false })
      const pinned = w.createTab({ url: 'https://en.wikipedia.org/wiki/Dolphin?banner=none' }, { activate: false })
      w.setPinned(pinned, true)
      w.activeTab.navigate('auralis://newtab/')
    })
    await wait(4000)
    shot('aq1-ntp')
    await W(() => { const w = [...globalThis.__auralis.BrowserWin.all.values()][0]; w.activate(w.tabs.find((t) => t.url.includes('Windows_Vista'))) })
    await W(() => globalThis.__auralis.settings.set({ sidebar: true, widgets: { analogClock: true, weather: true, slideshow: true, currency: true, aquarium: true, notes: true, news: false } }))
    await wait(4000)
    shot('aq2-page-gadgets')
    await chrome.evaluate(() => document.querySelector('.side-scroll')?.scrollTo(0, 2000))
    await wait(800)
    shot('aq3-gadgets-lower')
    await W(() => globalThis.__auralis.settings.set({ sidebar: false }))
    await chrome.click('.aq-orb')
    await wait(1000)
    shot('aq4-menu')
    await overlay.keyboard.press('Escape')
    await W(() => [...globalThis.__auralis.BrowserWin.all.values()][0].activeTab.navigate('auralis://settings/'))
    await wait(2000)
    shot('aq5-settings')
    await W(() => globalThis.__auralis.settings.set({ sidebarCompact: true }))
    await W(() => [...globalThis.__auralis.BrowserWin.all.values()][0].activeTab.navigate('auralis://newtab/'))
    await wait(2500)
    shot('aq6-compact')
    void win
  }
} catch (err) {
  console.error(err)
} finally {
  await app.close()
}
