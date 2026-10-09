// Configuration shared by every session that hosts web content: the
// persistent default profile and each InPrivate window's in-memory session.
import { app, session, webContents, type Session, type WebContents, type Certificate } from 'electron'
import { ctx, settings } from './context'
import { installProtocol } from './protocol'
import { installShield } from './shield'
import { EXTERNAL_SCHEMES, SCHEME, originOf } from '../shared/url'
import { logger } from './log'

const log = logger('session')

/** Chromium's UA without the "Electron/x" and app tokens, which some sites
 *  (notably sign-in pages) treat as an embedded, untrusted browser. */
export function cleanUserAgent(): string {
  return app.userAgentFallback
    .replace(/\s?Electron\/[\d.]+/i, '')
    .replace(/\s?auralis\/[\d.]+/i, '')
    .replace(/\s?Auralis\/[\d.]+/i, '')
}

// ---- permissions -----------------------------------------------------------

/** Granted without asking: low risk, needed for normal pages to work. */
const ALWAYS_ALLOW = new Set([
  'fullscreen',
  'clipboard-sanitized-write',
  'pointerLock',
  'keyboardLock',
  'persistent-storage',
  'storage-access',
  'top-level-storage-access',
  'speaker-selection'
])

/** Asked once per origin, remembered in the permissions table. */
export const PROMPTABLE = new Set(['geolocation', 'notifications', 'camera', 'microphone', 'midi', 'midiSysex', 'clipboard-read', 'idle-detection', 'window-management'])

export const PERMISSION_LABELS: Record<string, string> = {
  geolocation: 'Know your location',
  notifications: 'Show notifications',
  camera: 'Use your camera',
  microphone: 'Use your microphone',
  midi: 'Use MIDI devices',
  midiSysex: 'Control MIDI devices',
  'clipboard-read': 'See text and images copied to the clipboard',
  'idle-detection': 'Know when you are actively using this device',
  'window-management': 'Manage windows on all your displays',
  openExternal: 'Open an app on your computer'
}

export type PromptResult = 'allow' | 'deny' | 'dismiss'
type Prompter = (wc: WebContents, origin: string, permissions: string[], extra?: { externalUrl?: string }) => Promise<PromptResult>
let prompter: Prompter = async () => 'deny'
export const setPermissionPrompter = (p: Prompter) => (prompter = p)

type ScreenPicker = (wc: WebContents, origin: string, audio: boolean) => Promise<{ id: string; name: string; audio: boolean } | null>
let screenPicker: ScreenPicker = async () => null
export const setScreenPicker = (p: ScreenPicker) => (screenPicker = p)
/** Source chosen during the permission step, consumed by the display-media handler. */
const pendingShares = new Map<number, { id: string; name: string; audio: boolean }>()

function expand(permission: string, mediaTypes?: string[]): string[] {
  if (permission !== 'media') return [permission]
  const out: string[] = []
  if (mediaTypes?.includes('video')) out.push('camera')
  if (mediaTypes?.includes('audio')) out.push('microphone')
  return out.length ? out : ['camera', 'microphone']
}

// ---- certificates ------------------------------------------------------------

const certs = new Map<string, { cert: Certificate; ok: boolean }>()
export const certificateFor = (host: string) => certs.get(host) ?? null

const configured = new WeakSet<Session>()

export function setupWebSession(ses: Session, opts: { incognito: boolean }): void {
  if (configured.has(ses)) return
  configured.add(ses)
  installProtocol(ses)
  installShield(ses)
  ses.setUserAgent(cleanUserAgent())
  ses.setSpellCheckerEnabled(settings.get().spellcheck)

  ses.setCertificateVerifyProc((req, cb) => {
    certs.set(req.hostname, { cert: req.certificate, ok: req.verificationResult === 'net::OK' })
    if (certs.size > 500) certs.delete(certs.keys().next().value!)
    cb(-3) // defer to Chromium's own verification result
  })

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const requesting = 'requestingUrl' in details ? details.requestingUrl : wc.getURL()
    const origin = originOf(requesting ?? '')
    const top = wc.getURL()
    if (top.startsWith(`${SCHEME}:`) || origin.startsWith(`${SCHEME}:`)) return callback(permission === 'clipboard-sanitized-write')
    if (ALWAYS_ALLOW.has(permission)) return callback(true)

    if (permission === 'openExternal') {
      const ext = 'externalURL' in details ? (details.externalURL as string | undefined) : undefined
      let scheme = ''
      try {
        scheme = new URL(ext ?? '').protocol
      } catch {
        /* invalid */
      }
      if (!ext || !EXTERNAL_SCHEMES.has(scheme)) {
        log.warn('blocked external protocol', scheme, 'from', origin)
        return callback(false)
      }
      // Never remembered: each hand-off to another app is confirmed.
      prompter(wc, origin, ['openExternal'], { externalUrl: ext }).then((r) => callback(r === 'allow'), () => callback(false))
      return
    }

    const mediaTypes = 'mediaTypes' in details ? (details.mediaTypes as string[] | undefined) : undefined
    // getDisplayMedia arrives as "media" with no media types. The user picks
    // a screen or window here, so cancelling rejects with NotAllowedError as
    // in Chrome; the display-media handler then uses the chosen source.
    if (permission === 'media' && Array.isArray(mediaTypes) && mediaTypes.length === 0) {
      if (!isPotentiallyTrustworthy(origin)) return callback(false)
      screenPicker(wc, origin, true).then(
        (pick) => {
          if (pick) pendingShares.set(wc.id, pick)
          callback(!!pick)
        },
        () => callback(false)
      )
      return
    }
    const wanted = expand(permission, mediaTypes)
    if (!wanted.every((p) => PROMPTABLE.has(p))) return callback(false)
    // Powerful features need a secure context (Chromium counts loopback as secure).
    if (!isPotentiallyTrustworthy(origin)) return callback(false)

    const store = ctx.permissions
    const decisions = wanted.map((p) => (opts.incognito ? sessionDecisions.get(`${origin}|${p}`) : store.get(origin, p)) ?? null)
    if (decisions.some((d) => d === 'deny')) return callback(false)
    if (decisions.every((d) => d === 'allow')) return callback(true)

    prompter(wc, origin, wanted).then(
      (result) => {
        if (result !== 'dismiss') {
          for (const p of wanted) {
            if (opts.incognito) sessionDecisions.set(`${origin}|${p}`, result)
            else store.set(origin, p, result)
          }
        }
        callback(result === 'allow')
      },
      () => callback(false)
    )
  })

  ses.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => {
    if (requestingOrigin.startsWith(`${SCHEME}:`)) return permission === 'clipboard-sanitized-write'
    if (ALWAYS_ALLOW.has(permission)) return true
    const wanted = expand(permission, details.mediaType ? [details.mediaType] : undefined)
    const origin = originOf(requestingOrigin)
    void wc
    return wanted.every((p) => (opts.incognito ? sessionDecisions.get(`${origin}|${p}`) : ctx.permissions.get(origin, p)) === 'allow')
  })

  // Screen sharing: the user picks a screen or window, every time.
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const wc = request.frame ? webContents.fromFrame(request.frame) : null
      if (!wc || !request.videoRequested || !isPotentiallyTrustworthy(request.securityOrigin)) return callback(null)
      const pick = pendingShares.get(wc.id) ?? (await screenPicker(wc, request.securityOrigin, request.audioRequested))
      pendingShares.delete(wc.id)
      if (!pick) return callback(null)
      callback({ video: { id: pick.id, name: pick.name }, audio: pick.audio && request.audioRequested ? 'loopback' : undefined })
    } catch (err) {
      log.warn('display media request failed', err)
      callback(null)
    }
  })

  // USB / HID / serial / Bluetooth device access is not offered.
  ses.setDevicePermissionHandler(() => false)
  ses.on('select-hid-device', (e, _d, cb) => (e.preventDefault(), cb('')))
  ses.on('select-serial-port', (e, _d, _wc, cb) => (e.preventDefault(), cb('')))
  ses.on('select-usb-device', (e, _d, cb) => (e.preventDefault(), cb()))
}

export function isPotentiallyTrustworthy(origin: string): boolean {
  try {
    const u = new URL(origin)
    if (u.protocol === 'https:') return true
    if (u.protocol !== 'http:') return false
    return u.hostname === 'localhost' || u.hostname.endsWith('.localhost') || u.hostname === '127.0.0.1' || u.hostname === '[::1]'
  } catch {
    return false
  }
}

/** InPrivate decisions live only as long as the process. */
const sessionDecisions = new Map<string, 'allow' | 'deny'>()

settings.onChange((next, prev) => {
  if (next.spellcheck !== prev.spellcheck) session.defaultSession.setSpellCheckerEnabled(next.spellcheck)
})
