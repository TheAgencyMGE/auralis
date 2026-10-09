// One transparent WebContentsView per window that draws everything which
// must appear above web content: menus, the omnibox dropdown, popovers,
// prompts, tab previews and Tab Flip. Web views cannot be overdrawn by the
// chrome's own DOM, so this view is stacked on top only while something is
// open, sized to exactly what it shows so clicks elsewhere still land.
import { WebContentsView, type BrowserWindow, type Session } from 'electron'
import path from 'node:path'
import { IPC_EVENT } from '../shared/ipc'
import type { OverlayContent, OverlayRequest, Rect } from '../shared/types'
import { uiUrl } from './protocol'
import { logger } from './log'

const log = logger('overlay')

/** Room around the popup for its drop shadow; the overlay page uses the same value. */
export const SHADOW = 14

export interface OverlayHandlers {
  onAction?: (id: string, payload: unknown) => void
  onClose?: () => void
}

interface Open {
  token: number
  req: OverlayRequest
  handlers: OverlayHandlers
  shown: boolean
}

export class Overlay {
  readonly view: WebContentsView
  private ready = false
  private pending: (() => void) | null = null
  private open: Open | null = null
  private token = 0
  private blurTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly win: BrowserWindow,
    uiSession: Session,
    private readonly onKey: (wc: Electron.WebContents, input: Electron.Input) => boolean,
    /** Called after a focused popup closes, so focus returns to the window. */
    private readonly restoreFocus: () => void
  ) {
    this.view = new WebContentsView({
      webPreferences: {
        session: uiSession,
        preload: path.join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        backgroundThrottling: false
      }
    })
    this.view.setBackgroundColor('#00000000')
    this.view.setVisible(false)
    const wc = this.view.webContents
    wc.setWindowOpenHandler(() => ({ action: 'deny' }))
    void import('./window').then((m) => m.watchUiConsole(wc, 'overlay'))
    wc.on('will-navigate', (e) => e.preventDefault())
    wc.on('did-finish-load', () => {
      this.ready = true
      const p = this.pending
      this.pending = null
      p?.()
    })
    wc.on('render-process-gone', (_e, d) => {
      log.error('overlay renderer gone', d.reason)
      this.ready = false
      this.open = null
      this.view.setVisible(false)
      wc.reload()
    })
    wc.on('blur', () => {
      // Menus close when focus leaves them (click elsewhere, Alt+Tab...).
      if (!this.open || this.open.req.passive) return
      if (this.blurTimer) clearTimeout(this.blurTimer)
      this.blurTimer = setTimeout(() => {
        if (this.open && !this.open.req.passive && !this.view.webContents.isFocused()) this.hide()
      }, 60)
    })
    wc.on('before-input-event', (e, input) => {
      if (this.onKey(wc, input)) e.preventDefault()
    })
    wc.setZoomFactor(1)
    wc.setVisualZoomLevelLimits(1, 1)
    void wc.loadURL(uiUrl('overlay'))
  }

  get kind(): OverlayContent['kind'] | null {
    return this.open?.req.content.kind ?? null
  }

  isOpen(kind?: OverlayContent['kind']): boolean {
    return !!this.open && (!kind || this.open.req.content.kind === kind)
  }

  /** Show new content, replacing whatever is open. */
  show(req: OverlayRequest, handlers: OverlayHandlers = {}): void {
    const prev = this.open
    if (prev && prev.req.content.kind !== req.content.kind) {
      this.open = null
      prev.handlers.onClose?.()
    }
    const token = ++this.token
    this.open = { token, req, handlers, shown: prev?.shown && prev.req.content.kind === req.content.kind ? true : false }
    const send = () => {
      if (this.open?.token !== token) return
      // Lay out at full window size first so the page can measure freely.
      if (!this.open.shown) this.view.setBounds(this.fullBounds())
      this.view.webContents.send(IPC_EVENT, 'overlay', {
        token,
        content: req.content,
        modal: !!req.modal,
        align: req.align,
        shadow: SHADOW
      })
    }
    if (this.ready) send()
    else this.pending = send
  }

  /** Update the content of the open overlay in place (omnibox while typing). */
  update(content: OverlayContent): void {
    if (!this.open) return
    this.show({ ...this.open.req, content }, this.open.handlers)
  }

  /** Called by the overlay page once it has laid out the content. */
  measured(token: number, size: { width: number; height: number }): void {
    if (!this.open || this.open.token !== token) return
    const req = this.open.req
    const bounds = req.modal ? this.fullBounds() : this.place(req.anchor, req.align, size)
    this.view.setBounds(bounds)
    if (!this.open.shown) {
      this.open.shown = true
      // Re-adding moves the view to the top of the stack.
      this.win.contentView.addChildView(this.view)
      this.view.setVisible(true)
    }
    this.view.webContents.send(IPC_EVENT, 'overlay', { token, placed: { x: bounds.x, y: bounds.y } })
    if (!req.passive) this.view.webContents.focus()
  }

  action(id: string, payload: unknown): void {
    this.open?.handlers.onAction?.(id, payload)
  }

  hide(): void {
    if (this.blurTimer) clearTimeout(this.blurTimer)
    const open = this.open
    const hadFocus = !this.view.webContents.isDestroyed() && this.view.webContents.isFocused()
    this.open = null
    this.view.setVisible(false)
    if (hadFocus) this.restoreFocus()
    if (!this.view.webContents.isDestroyed()) this.view.webContents.send(IPC_EVENT, 'overlay', { token: ++this.token, content: null })
    open?.handlers.onClose?.()
  }

  /** Keep the overlay above tab views after the stack changes. */
  raise(): void {
    if (this.open?.shown) this.win.contentView.addChildView(this.view)
  }

  relayout(): void {
    if (this.open?.req.modal && this.open.shown) this.view.setBounds(this.fullBounds())
    else if (this.open && !this.open.req.passive) this.hide()
  }

  private fullBounds(): Rect {
    const [width, height] = this.win.getContentSize()
    return { x: 0, y: 0, width, height }
  }

  private place(anchor: Rect, align: OverlayRequest['align'], size: { width: number; height: number }): Rect {
    const [winW, winH] = this.win.getContentSize()
    const w = Math.ceil(size.width) + SHADOW * 2
    const h = Math.ceil(size.height) + SHADOW * 2
    let x =
      align === 'end' ? anchor.x + anchor.width - w + SHADOW : align === 'center' ? anchor.x + anchor.width / 2 - w / 2 : anchor.x - SHADOW
    let y = anchor.y + anchor.height - SHADOW + 2
    if (y + h > winH && anchor.y - h + SHADOW > 0) y = anchor.y - h + SHADOW - 2 // flip above
    x = Math.max(0, Math.min(x, winW - w))
    y = Math.max(0, Math.min(y, winH - h))
    return { x: Math.round(x), y: Math.round(y), width: Math.min(w, winW), height: Math.min(h, winH) }
  }

  destroy(): void {
    if (!this.view.webContents.isDestroyed()) this.view.webContents.close()
  }
}
