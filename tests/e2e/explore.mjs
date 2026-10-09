// Visual exploration: drives Auralis through real flows and captures what
// the screen shows (acrylic and composited views included).
// Usage: node tests/e2e/explore.mjs <profileDir> <outDir> [scenario]
import { _electron as electron } from 'playwright'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const [profile, outDir, scenario = 'basic'] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const app = await electron.launch({ args: ['.', ...(process.env.EXTRA_ARGS ? process.env.EXTRA_ARGS.split(' ') : [])], env: { ...process.env, AURALIS_E2E: '1', AURALIS_USER_DATA: profile } })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (name) => {
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/shot.ps1', '-Out', path.join(outDir, `${name}.png`)], { stdio: 'inherit' })
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
    await chrome.click('.orb-button')
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
} catch (err) {
  console.error(err)
} finally {
  await app.close()
}
