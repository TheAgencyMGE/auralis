// Visual exploration: drives Auralis through real flows and captures what
// the screen shows (acrylic and composited views included).
// Usage: node tests/e2e/explore.mjs <profileDir> <outDir> [scenario]
import { _electron as electron } from 'playwright'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const [profile, outDir, scenario = 'basic'] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const app = await electron.launch({ args: ['.'], env: { ...process.env, AURALIS_E2E: '1', AURALIS_USER_DATA: profile } })
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
} catch (err) {
  console.error(err)
} finally {
  await app.close()
}
