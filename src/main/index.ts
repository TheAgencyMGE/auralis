// Auralis main process entry.
import { app, crashReporter, Menu, session } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { ctx, settings, userFile } from './context'
import { openDatabase } from './data/db'
import { HistoryStore } from './data/history'
import { BookmarkStore } from './data/bookmarks'
import { DownloadStore } from './data/downloads'
import { PermissionStore } from './data/permissions'
import { FaviconStore } from './data/favicons'
import { registerSchemePrivileges } from './protocol'
import { installIpc } from './ipc'
import { initShield, installShieldIpc, onBlocked } from './shield'
import { setPermissionPrompter } from './web-session'
import { BrowserWin, wireWindowHooks } from './window'
import { handleKey } from './shortcuts'
import { initSessionStore, scheduleSave, onWindowClosing, onWindowClosed, flushOnQuit } from './session-store'
import { promptPermission } from './menus'
import { installDownloads, onDownloadComplete, onDownloadStarted, onDownloadsChanged, hasActiveDownloads } from './downloads'
import { logger } from './log'
import { NEW_TAB_URL } from '../shared/url'

const log = logger('main')
const started = Date.now()

// Tests and screenshots run against a throwaway profile.
if (process.env.AURALIS_USER_DATA) app.setPath('userData', process.env.AURALIS_USER_DATA)

registerSchemePrivileges()
app.setAppUserModelId('com.auralis.browser')
// Minidumps stay on this machine; nothing is uploaded.
crashReporter.start({ uploadToServer: false })

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    const { urls, newWindow, inPrivate } = parseArgs(argv.slice(1))
    if (inPrivate) return void new BrowserWin({ incognito: true, initialUrls: urls })
    const target = newWindow ? null : (BrowserWin.lastFocused ?? [...BrowserWin.all.values()].find((w) => !w.incognito) ?? null)
    if (!target) return void new BrowserWin({ initialUrls: urls })
    if (target.win.isMinimized()) target.win.restore()
    target.win.focus()
    for (const url of urls) target.createTab({ url })
  })
  void app.whenReady().then(boot)
}

/** Command-line: URLs/files to open, plus the Jump List flags. */
export function parseArgs(argv: string[]): { urls: string[]; newWindow: boolean; inPrivate: boolean } {
  const urls: string[] = []
  let newWindow = false
  let inPrivate = false
  for (const a of argv) {
    if (a === '--new-window') newWindow = true
    else if (a === '--inprivate') inPrivate = true
    else if (/^https?:\/\//i.test(a)) urls.push(a)
    else if (!a.startsWith('-') && /\.(html?|xhtml|svg|pdf|txt)$/i.test(a) && fs.existsSync(a)) urls.push('file:///' + path.resolve(a).replace(/\\/g, '/'))
  }
  return { urls, newWindow, inPrivate }
}

function openDb() {
  const file = userFile('auralis.db')
  try {
    return openDatabase(file)
  } catch (err) {
    // A corrupt database must not keep the browser from starting.
    log.error('database unusable, starting fresh', err)
    for (const ext of ['', '-wal', '-shm']) {
      try {
        if (fs.existsSync(file + ext)) fs.renameSync(file + ext, `${file}.corrupt-${Date.now()}${ext}`)
      } catch {
        /* ignore */
      }
    }
    return openDatabase(file)
  }
}

async function boot(): Promise<void> {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  const db = openDb()
  Object.assign(ctx, {
    db,
    history: new HistoryStore(db),
    bookmarks: new BookmarkStore(db),
    downloads: new DownloadStore(db),
    permissions: new PermissionStore(db),
    favicons: new FaviconStore(db)
  })
  settings.load()
  Menu.setApplicationMenu(null)

  installShieldIpc()
  void initShield()
  installIpc()

  wireWindowHooks({ handleKey, onWindowClosing, onWindowClosed, scheduleSessionSave: scheduleSave })
  setPermissionPrompter(async (wc, origin, permissions, extra) => {
    for (const w of BrowserWin.all.values()) {
      const tab = w.tabs.find((t) => t.wc === wc)
      if (tab) return promptPermission(w, tab, origin, permissions, extra)
    }
    return 'deny'
  })
  app.on('session-created', (ses) => installDownloads(ses, ses !== session.defaultSession && !ses.isPersistent()))
  installDownloads(session.defaultSession, false)
  onDownloadsChanged(() => BrowserWin.all.forEach((w) => w.pushState()))
  onDownloadStarted((_d, incognito) => {
    const w = [...BrowserWin.all.values()].find((x) => x.incognito === incognito && x.win.isFocused()) ?? BrowserWin.lastFocused
    w?.pushState()
  })
  onDownloadComplete((d) => BrowserWin.lastFocused?.toast(`Downloaded “${d.filename}”`, 'download'))
  onBlocked((wcId) => {
    for (const w of BrowserWin.all.values()) if (w.activeTab?.wc?.id === wcId) w.pushState()
  })

  app.setUserTasks([
    { program: process.execPath, arguments: app.isPackaged ? '--new-window' : `"${app.getAppPath()}" --new-window`, iconPath: process.execPath, iconIndex: 0, title: 'New window', description: 'Open a new Auralis window' },
    { program: process.execPath, arguments: app.isPackaged ? '--inprivate' : `"${app.getAppPath()}" --inprivate`, iconPath: process.execPath, iconIndex: 0, title: 'New InPrivate window', description: 'Browse without saving history' }
  ])

  const { previous, unclean } = initSessionStore()
  const { urls, inPrivate } = parseArgs(process.argv.slice(app.isPackaged ? 1 : 2))
  const s = settings.get()
  const restore = previous?.windows.length && (s.startup === 'restore' || unclean)
  if (restore) {
    for (const snap of previous!.windows) new BrowserWin({ snapshot: snap, restoreAsleep: s.restoreAsleep || unclean })
    const target = BrowserWin.lastFocused
    for (const url of urls) target?.createTab({ url })
  } else {
    const first = s.startup === 'home' ? s.homePage : NEW_TAB_URL
    new BrowserWin({ initialUrls: urls.length ? urls : [first] })
  }
  if (inPrivate) new BrowserWin({ incognito: true })
  log.info(`ready in ${Date.now() - started} ms`, restore ? `(restored ${previous!.windows.length} window(s))` : '')

  setInterval(sleepIdleTabs, 60_000).unref()

  // End-to-end tests reach into the main process; never in packaged builds.
  if (process.env.AURALIS_E2E === '1' && !app.isPackaged) {
    const { runCommand } = await import('./commands')
    Object.assign(globalThis, { __auralis: { BrowserWin, runCommand, ctx, settings, sleepIdleTabs } })
  }
}

/** Discard background tabs the user hasn't looked at for a while. */
function sleepIdleTabs(): void {
  const minutes = settings.get().sleepAfterMinutes
  if (!minutes) return
  const cutoff = Date.now() - minutes * 60_000
  for (const w of BrowserWin.all.values()) {
    const active = w.activeTab
    for (const t of w.tabs) {
      if (!t.wc || t === active || t.closing || t.audible || t.loading || w.isInSplit(t)) continue
      if (t.wc.isDevToolsOpened()) continue
      if (t.lastActive < cutoff) {
        log.debug('sleeping tab', t.id, t.displayUrl())
        t.sleep()
      }
    }
  }
}

// Defence in depth for every webContents, including ones we didn't create.
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (e) => e.preventDefault())
  if (wc.getType() === 'webview') wc.close()
})

app.on('window-all-closed', () => app.quit())

let quitConfirmed = false
app.on('before-quit', (e) => {
  if (!quitConfirmed && hasActiveDownloads()) {
    e.preventDefault()
    const w = BrowserWin.lastFocused ?? [...BrowserWin.all.values()][0]
    if (!w) {
      quitConfirmed = true
      return app.quit()
    }
    w.confirm(
      { title: 'Downloads are in progress', message: 'Quitting now will cancel them.', confirm: 'Quit anyway', cancel: 'Keep downloading' },
      () => {
        quitConfirmed = true
        app.quit()
      }
    )
    return
  }
  flushOnQuit()
  settings.flush()
})

app.on('will-quit', () => {
  try {
    ctx.db?.close()
  } catch {
    /* already closed */
  }
})

process.on('uncaughtException', (err) => log.error('uncaught exception', err))
process.on('unhandledRejection', (err) => log.error('unhandled rejection', err))

