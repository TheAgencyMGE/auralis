import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fixtureServer, launch, omniboxGo, tempProfile, until, wait, type Harness } from './helpers'

let server: Awaited<ReturnType<typeof fixtureServer>>
let h: Harness

test.beforeAll(async () => {
  server = await fixtureServer()
})
test.afterAll(async () => {
  await server.close()
})
test.afterEach(async () => {
  await h?.close().catch(() => {})
})

test('starts with a new tab page and the chrome', async () => {
  h = await launch()
  const ntp = await h.page('auralis://newtab')
  await expect(ntp.locator('.ntp-search input')).toBeVisible()
  await expect(h.chrome.locator('.tab')).toHaveCount(1)
  await expect(h.chrome.locator('.tab-title')).toHaveText('New Tab')
})

test('navigates from the omnibox, records history and updates the tab', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/a'))
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
  await expect(h.chrome.locator('.tab-title')).toHaveText('Page A')
  // Unfocused, the omnibox shows the URL without the scheme for http? No: http stays visible.
  await expect(h.chrome.locator('.omnibox-input')).toHaveValue(/127\.0\.0\.1/)
  const history = await h.app.evaluate(() => (globalThis as any).__auralis.ctx.history.search('Page A'))
  expect(history[0].url).toContain('/a')
})

test('back and forward work and the orbs reflect history', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/a'))
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
  const tab = await h.page(server.url('/a'))
  await tab.click('#tob')
  await until(h.state, (s) => s.tabs[0].title === 'Page B')
  await expect(h.chrome.locator('.nav-orb.is-back')).toBeEnabled()
  await h.chrome.click('.nav-orb.is-back')
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
  await expect(h.chrome.locator('.nav-orb.is-forward')).toBeEnabled()
})

test('keyboard shortcuts open, close and reopen tabs', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/a'))
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
  await h.press('tab', 'T', ['control'])
  await until(h.state, (s) => s.tabs.length === 2)
  await h.press('chrome', 'W', ['control'])
  await until(h.state, (s) => s.tabs.length === 1)
  // Close the page tab too, then bring it back with its title.
  await h.press('tab', 'T', ['control'])
  await until(h.state, (s) => s.tabs.length === 2)
  const first = (await h.state()).tabs[0].id
  await h.app.evaluate((_e, id) => {
    const w = [...(globalThis as any).__auralis.BrowserWin.all.values()][0] as any
    w.closeTab(w.tabById(id))
  }, first)
  await until(h.state, (s) => s.tabs.length === 1)
  await h.press('chrome', 'T', ['control', 'shift'])
  const s = await until(h.state, (s) => s.tabs.length === 2 && s.tabs.some((t) => t.url.endsWith('/a')))
  expect(s.tabs.find((t) => t.url.endsWith('/a'))).toBeTruthy()
})

test('omnibox suggests history and completes hosts inline', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/a'))
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
  const input = h.chrome.locator('.omnibox-input')
  await input.click()
  await input.pressSequentially('Page', { delay: 30 })
  await until(h.state, (s) => s.overlay === 'omnibox')
  await expect(h.overlay.locator('.omni-row')).not.toHaveCount(0)
  await expect(h.overlay.locator('.omni-row', { hasText: 'Page A' })).toBeVisible()
  await input.press('Escape')
})

test('find in page reports matches', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/a'))
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
  await h.press('tab', 'F', ['control'])
  const field = h.chrome.locator('.findbar-input')
  await expect(field).toBeVisible()
  await field.fill('needle')
  await expect(h.chrome.locator('.findbar-count')).toHaveText(/of 2/)
  await field.press('Escape')
  await expect(field).toHaveCount(0)
})

test('favorites: Ctrl+D stars the page and it appears on the bar', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/b'))
  await until(h.state, (s) => s.tabs[0].title === 'Page B')
  await h.press('tab', 'D', ['control'])
  await until(h.state, (s) => s.overlay === 'bookmark')
  await expect(h.chrome.locator('.fav-item', { hasText: 'Page B' })).toBeVisible()
  await expect(h.chrome.locator('.star-btn.is-on')).toBeVisible()
  await h.overlay.locator('button', { hasText: 'Remove' }).click()
  await expect(h.chrome.locator('.fav-item', { hasText: 'Page B' })).toHaveCount(0)
})

test('window.open becomes a tab that keeps its opener', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/popup'))
  await until(h.state, (s) => s.tabs[0].title === 'Opener')
  const opener = await h.page(server.url('/popup'))
  await opener.click('#open')
  await until(h.state, (s) => s.tabs.length === 2)
  // The child posted a message to window.opener, so the opener's title changed.
  await until(h.state, (s) => s.tabs[0].title === 'got hello')
})

test('web pages get no bridge and cannot open internal pages', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/hostile'))
  await until(h.state, (s) => s.tabs[0].title === 'checked')
  const page = await h.page(server.url('/hostile'))
  expect(await page.evaluate(() => (window as any).result)).toEqual({ bridge: 'undefined', node: 'undefined', process: 'undefined' })
  await page.click('#int', { noWaitAfter: true })
  await wait(800)
  expect((await h.state()).tabs[0].url).toContain('/hostile')
  // The iframe pointing at auralis://settings must not have loaded the page.
  const framed = await page.evaluate(() => {
    try {
      return (document.getElementById('frame') as HTMLIFrameElement).contentDocument?.title ?? 'blocked'
    } catch {
      return 'blocked'
    }
  })
  expect(framed).not.toBe('Settings')
  // And a forged IPC call from the page is impossible: there is no ipcRenderer.
  expect(await page.evaluate(() => typeof (window as any).ipcRenderer)).toBe('undefined')
})

test('internal pages expose only their own methods', async () => {
  h = await launch()
  const ntp = await h.page('auralis://newtab')
  const denied = await ntp.evaluate(() => (window as any).auralis.call('history.clear').then(() => 'allowed', (e: Error) => e.message))
  expect(denied).toMatch(/not allowed/i)
  const setting = await ntp.evaluate(() => (window as any).auralis.call('settings.set', { homePage: 'https://evil.example' }).then(() => 'allowed', (e: Error) => e.message))
  expect(setting).not.toBe('allowed')
})

test('sleeping tabs wake up with back/forward history intact', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/a'))
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
  await omniboxGo(h, server.url('/b'))
  await until(h.state, (s) => s.tabs[0].title === 'Page B')
  await h.press('tab', 'T', ['control'])
  await until(h.state, (s) => s.tabs.length === 2)
  const first = (await h.state()).tabs[0].id
  await h.app.evaluate((_e, id) => {
    const w = [...(globalThis as any).__auralis.BrowserWin.all.values()][0] as any
    w.tabById(id).sleep()
  }, first)
  await until(h.state, (s) => s.tabs[0].asleep)
  await h.chrome.locator('.tab').first().click()
  await until(h.state, (s) => !s.tabs[0].asleep && s.tabs[0].title === 'Page B')
  await expect(h.chrome.locator('.nav-orb.is-back')).toBeEnabled()
  await h.chrome.click('.nav-orb.is-back')
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
})

test('split view shows two tabs side by side', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/a'))
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
  await h.press('tab', 'T', ['control'])
  await omniboxGo(h, server.url('/b'))
  await until(h.state, (s) => s.tabs.length === 2 && s.tabs[1].title === 'Page B')
  await h.chrome.click('button[aria-label="Split view"]')
  await until(h.state, (s) => !!s.split)
  const bounds = await h.app.evaluate(() => {
    const w = [...(globalThis as any).__auralis.BrowserWin.all.values()][0] as any
    return w.tabs.map((t: any) => t.view.getBounds())
  })
  expect(bounds[0].x + bounds[0].width).toBeLessThanOrEqual(bounds[1].x)
  await expect(h.chrome.locator('.split-divider')).toBeVisible()
})

test('downloads finish into the chosen folder', async () => {
  h = await launch()
  const dir = fs.mkdtempSync(path.join(h.profile, 'dl-'))
  await h.app.evaluate((_e, d) => (globalThis as any).__auralis.settings.set({ downloadDir: d }), dir)
  await omniboxGo(h, server.url('/download'))
  await until(
    async () => fs.existsSync(path.join(dir, 'auralis-test.bin')) && fs.statSync(path.join(dir, 'auralis-test.bin')).size,
    (v) => v === 64 * 1024
  )
  await until(() => h.app.evaluate(() => (globalThis as any).__auralis.ctx.downloads.list()[0]?.state), (v) => v === 'completed')
})

test('unreachable sites show an explanatory error page', async () => {
  h = await launch()
  await omniboxGo(h, 'http://127.0.0.1:9/')
  const err = await h.page('auralis://error')
  await expect(err.locator('h1')).toContainText(/refused|can’t|took too long/i)
  // The omnibox keeps showing the address the user asked for.
  await expect(h.chrome.locator('.omnibox-input')).toHaveValue(/127\.0\.0\.1:9/)
})

test('reader view extracts the article', async () => {
  h = await launch()
  await omniboxGo(h, server.url('/article'))
  await until(h.state, (s) => s.tabs[0].title === 'A long read about glass')
  await expect(h.chrome.locator('button[aria-label="Reader view"]')).toBeVisible({ timeout: 8000 })
  await h.chrome.click('button[aria-label="Reader view"]')
  const reader = await h.page('auralis://reader')
  await expect(reader.locator('h1.r-title')).toHaveText('A long read about glass')
  await expect(reader.locator('article p').first()).toContainText('Paragraph 1')
})

test('session restore brings tabs back asleep after a restart', async () => {
  const profile = tempProfile()
  h = await launch(profile)
  await omniboxGo(h, server.url('/a'))
  await until(h.state, (s) => s.tabs[0].title === 'Page A')
  await h.press('tab', 'T', ['control'])
  await omniboxGo(h, server.url('/c'))
  await until(h.state, (s) => s.tabs.length === 2 && s.tabs[1].title === 'Page C')
  await h.close()
  h = await launch(profile)
  const s = await until(h.state, (s) => s.tabs.length === 2)
  expect(s.tabs[0].url).toContain('/a')
  expect(s.tabs[0].asleep).toBe(true)
  expect(s.tabs[1].url).toContain('/c')
})

test('settings persist and are sanitized', async () => {
  const profile = tempProfile()
  h = await launch(profile)
  const settings = await h.page('auralis://newtab')
  await settings.evaluate(() => (window as any).auralis.call('settings.set', { wallpaper: 'aurora' }))
  await h.close()
  const file = JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8'))
  expect(file.wallpaper).toBe('aurora')
  file.searchEngine = 'javascript:alert(1)'
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(file))
  h = await launch(profile)
  const engine = await h.app.evaluate(() => (globalThis as any).__auralis.settings.get().searchEngine)
  expect(engine).toBe('bing')
})

test('app menu, spaces and Tab Flip open in the overlay', async () => {
  h = await launch()
  await h.chrome.click('.orb-button')
  await until(h.state, (s) => s.overlay === 'appmenu')
  await expect(h.overlay.locator('.am-item', { hasText: 'New InPrivate window' })).toBeVisible()
  await h.overlay.keyboard.press('Escape')
  await until(h.state, (s) => s.overlay === null)
  await h.chrome.click('.space-gem')
  await until(h.state, (s) => s.overlay === 'spaces')
  await h.overlay.locator('button', { hasText: 'New space' }).click()
  await until(h.state, (s) => s.spaces === 2)
  await h.press('focused', 'A', ['control', 'shift'])
  await until(h.state, (s) => s.overlay === 'tabflip')
  await expect(h.overlay.locator('.flip-card')).not.toHaveCount(0)
})
