// Renderer access to the preload bridge, plus small React hooks.
import { useEffect, useState } from 'react'
import type { AuralisBridge, EventName, Method } from '@shared/ipc'
import type { Settings } from '@shared/settings'
import { DEFAULT_SETTINGS, FRAME_COLORS } from '@shared/settings'

declare global {
  interface Window {
    auralis?: AuralisBridge
  }
}

export const bridge = (): AuralisBridge => {
  if (!window.auralis) throw new Error('Auralis bridge unavailable')
  return window.auralis
}

export function call<T = unknown>(method: Method, ...args: unknown[]): Promise<T> {
  return bridge().call<T>(method, ...args)
}

export function useEvent<T>(name: EventName, cb: (payload: T) => void, deps: unknown[] = []): void {
  useEffect(() => bridge().on(name, (p) => cb(p as T)), deps) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useSettings(): Settings {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS)
  useEffect(() => {
    let live = true
    void call<Settings>('settings.get').then((v) => live && setS(v))
    const off = bridge().on('settings', (v) => setS(v as Settings))
    return () => {
      live = false
      off()
    }
  }, [])
  return s
}

export function rectOf(el: Element | null): { x: number; y: number; width: number; height: number } {
  const r = el?.getBoundingClientRect()
  return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : { x: 0, y: 0, width: 0, height: 0 }
}

/** Apply the user's frame colour to CSS custom properties. */
export function applyFrameTokens(s: Settings, root: HTMLElement = document.documentElement): void {
  const tint = FRAME_COLORS[s.frameColor]?.tint ?? FRAME_COLORS.sky.tint
  root.style.setProperty('--frame-tint', tint)
  root.style.setProperty('--frame-alpha', String(0.28 + (s.glassIntensity / 100) * 0.5))
  root.style.setProperty('--frame-solid', s.transparency ? '0' : '1')
}

export function formatBytes(n: number): string {
  if (!n || n < 0) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : n / 1024 ** i < 10 ? 1 : 0)} ${u[i]}`
}

export function relativeTime(t: number): string {
  const d = Date.now() - t
  if (d < 60_000) return 'Just now'
  if (d < 3_600_000) return `${Math.round(d / 60_000)} min ago`
  if (d < 86_400_000) return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })
}
