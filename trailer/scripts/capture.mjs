// Captures real Auralis hero shots for the trailer. Run from the Auralis
// repo root after `npm run build`:  node trailer/scripts/capture.mjs
// A full-screen sky sits behind the window so the acrylic glass blurs a
// Frutiger Aero sky rather than whatever is on the desktop.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const root = process.cwd()
const { _electron: electron } = createRequire(path.join(root, 'package.json'))('playwright')
const out = path.join(root, 'trailer', 'public', 'shots')
fs.mkdirSync(out, { recursive: true })
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'auralis-trailer-'))
const backdrop = path.join(root, 'src', 'renderer', 'public', 'live', 'fields.webp').replace(/\\/g, '/')

const app = await electron.launch({ args: ['.'], env: { ...process.env, AURALIS_E2E: '1', AURALIS_USER_DATA: profile } })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const W = (fn, arg) => app.evaluate(fn, arg)
// LOOK=modern captures the Vista-glass look; its shots are named modern-*.
const LOOK = process.env.LOOK === 'modern' ? 'modern' : 'aqua'
const shot = (name) => {
  const file = LOOK === 'modern' ? `modern-${name}` : name
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/shot.ps1', '-Out', path.join(out, `${file}.png`), '-Title', 'Auralis E2E'], { stdio: 'inherit' })
}
const page = async (prefix) => {
  for (let i = 0; i < 80; i++) {
    const p = app.windows().find((w) => w.url().startsWith(prefix))
    if (p) return p
    await wait(100)
  }
  throw new Error('no page ' + prefix)
}
const nav = (u) => W((_e, u) => [...globalThis.__auralis.BrowserWin.all.values()][0].activeTab.navigate(u), u)

try {
  await wait(2500)
  await W(({ BrowserWindow, screen }, img) => {
    const a = globalThis.__auralis
    const { bounds } = screen.getPrimaryDisplay()
    const sky = new BrowserWindow({ ...bounds, frame: false, skipTaskbar: true, focusable: false, show: false, backgroundColor: '#3a8fd8' })
    sky.setAlwaysOnTop(true, 'floating')
    void sky.loadURL(`data:text/html,<body style="margin:0;background:url('file:///${img}') center/cover"></body>`)
    sky.once('ready-to-show', () => sky.showInactive())
    globalThis.__sky = sky
    const w = [...a.BrowserWin.all.values()][0]
    w.win.setTitle('Auralis E2E')
    w.win.setAlwaysOnTop(true, 'pop-up-menu')
    w.win.setBounds({ x: Math.round((bounds.width - 1600) / 2), y: Math.round((bounds.height - 960) / 2), width: 1600, height: 960 })
    a.settings.set({
      uiStyle: process.env.LOOK === 'modern' ? 'modern' : 'aqua',
      wallpaper: 'live:fields',
      weatherLocation: { name: 'Honolulu, Hawaii, United States', lat: 21.3, lon: -157.85 },
      widgets: { analogClock: true, weather: true, slideshow: false, aquarium: true, notes: false, meter: false, news: false, currency: false },
      notes: '',
      showBookmarksBar: false
    })
  }, backdrop)
  await wait(2500)
  const chrome = await page('auralis://chrome')
  const overlay = await page('auralis://overlay')

  // A few real sites so the tab strip looks lived in.
  await W(() => {
    const w = [...globalThis.__auralis.BrowserWin.all.values()][0]
    for (const u of ['https://en.wikipedia.org/wiki/Frutiger_Aero?banner=none', 'https://en.wikipedia.org/wiki/Windows_Vista?banner=none', 'https://en.wikipedia.org/wiki/Dolphin?banner=none']) w.createTab({ url: u }, { activate: false })
  })
  await wait(5000)
  await W(() => { const w = [...globalThis.__auralis.BrowserWin.all.values()][0]; w.activate(w.tabs[0]) })
  await wait(3500)
  shot('ntp-fields')

  // Another live wallpaper.
  await W(() => globalThis.__auralis.settings.set({ wallpaper: 'live:dolphins' }))
  await wait(3000)
  shot('ntp-dolphins')
  await W(() => globalThis.__auralis.settings.set({ wallpaper: 'live:bubbles' }))
  await wait(3000)
  shot('ntp-bubbles')

  // A web page with the Sidebar of gadgets.
  await W(() => { const w = [...globalThis.__auralis.BrowserWin.all.values()][0]; w.activate(w.tabs[1]) })
  await W(() => globalThis.__auralis.settings.set({ sidebar: true, widgets: { slideshow: true } }))
  await wait(3500)
  shot('sidebar-wiki')
  await W(() => globalThis.__auralis.settings.set({ sidebar: false }))
  await wait(800)

  // The app menu.
  await chrome.click('.aq-orb, .orb-button')
  await wait(1200)
  shot('appmenu')
  await overlay.keyboard.press('Escape')
  await wait(500)

  // Flip 3D, flipped through.
  await W(() => { const a = globalThis.__auralis; a.runCommand([...a.BrowserWin.all.values()][0], 'flip-3d') })
  await wait(1800)
  shot('flip3d-0')
  for (const i of [1, 2]) {
    await overlay.keyboard.press('ArrowDown')
    await wait(900)
    shot(`flip3d-${i}`)
  }
  await overlay.keyboard.press('Escape')
  await wait(500)

  // Tab Flip grid.
  await W(() => { const a = globalThis.__auralis; a.runCommand([...a.BrowserWin.all.values()][0], 'tab-flip') })
  await wait(1800)
  shot('tabflip')
  await overlay.keyboard.press('Escape')
  await wait(500)

  // Welcome Center.
  await nav('auralis://welcome/')
  await wait(2000)
  shot('welcome')

  // The splash, held still for the screenshot.
  await nav('auralis://newtab/')
  await wait(2500)
  await W(() => [...globalThis.__auralis.BrowserWin.all.values()][0].showOverlay({ content: { kind: 'splash' }, anchor: { x: 0, y: 0, width: 0, height: 0 }, align: 'center', modal: true, passive: true }))
  await wait(800)
  await overlay.evaluate(() => document.querySelectorAll('.ov-modal, .splash').forEach((e) => (e.style.animation = 'none')))
  shot('splash')
  await W(() => [...globalThis.__auralis.BrowserWin.all.values()][0].overlay.hide())

  // EXTRA=1: a few more screens for the README and the website.
  if (process.env.EXTRA === '1') {
    await nav('auralis://settings/')
    await wait(2200)
    shot('settings')
    await W(() => globalThis.__auralis.setSafetyListsForTest([['example.com', 'phishing']]))
    await nav('https://example.com/')
    await wait(2500)
    shot('unsafe')
    await nav('https://en.wikipedia.org/wiki/Dolphin?banner=none')
    await W(() => globalThis.__auralis.settings.set({ sidebarCompact: true }))
    await wait(3000)
    shot('compact')
    await W(() => globalThis.__auralis.settings.set({ sidebarCompact: false }))
  }
} catch (err) {
  console.error(err)
} finally {
  await W(() => globalThis.__sky?.destroy()).catch(() => {})
  await app.close()
}
console.log(fs.readdirSync(out).join(' '))
