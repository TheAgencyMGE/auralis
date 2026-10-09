// The living layer of the new tab page: glass bubbles that rise and can be
// popped, soft bokeh, and sparkles of light — the water-and-light half of
// Frutiger Aero. One canvas, capped device pixel ratio, paused when hidden,
// and a single still frame when the user prefers reduced motion.
import { useEffect, useRef } from 'react'
import type { WallpaperId } from '@shared/settings'
import { playSound } from '@ui/sound'

interface Preset {
  bubbles: number
  bokeh: number
  sparkles: number
  /** bokeh tint */
  warm: boolean
  /** bubbles rise faster underwater */
  speed: number
}

const PRESETS: Record<WallpaperId, Preset> = {
  meadow: { bubbles: 9, bokeh: 10, sparkles: 6, warm: false, speed: 0.5 },
  lagoon: { bubbles: 14, bokeh: 6, sparkles: 10, warm: false, speed: 0.6 },
  cumulus: { bubbles: 10, bokeh: 8, sparkles: 5, warm: false, speed: 0.45 },
  deep: { bubbles: 34, bokeh: 4, sparkles: 2, warm: false, speed: 1 },
  dew: { bubbles: 6, bokeh: 16, sparkles: 8, warm: true, speed: 0.4 },
  aurora: { bubbles: 0, bokeh: 0, sparkles: 26, warm: false, speed: 0.3 },
  reef: { bubbles: 30, bokeh: 4, sparkles: 4, warm: false, speed: 1 },
  koi: { bubbles: 12, bokeh: 6, sparkles: 6, warm: true, speed: 0.5 },
  grass: { bubbles: 6, bokeh: 18, sparkles: 10, warm: true, speed: 0.4 },
  butterfly: { bubbles: 8, bokeh: 14, sparkles: 6, warm: true, speed: 0.4 },
  leaves: { bubbles: 8, bokeh: 16, sparkles: 8, warm: true, speed: 0.4 }
}

interface Bubble {
  x: number
  y: number
  r: number
  vy: number
  phase: number
  wobble: number
  popping: number // 0 = alive; >0 = pop animation progress
}

interface Orb {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  hue: number
  a: number
}

interface Spark {
  x: number
  y: number
  s: number
  t: number
  speed: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

export function Ambient({ wallpaper, enabled, sound }: { wallpaper: WallpaperId; enabled: boolean; sound: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !enabled) return
    const ctx = canvas.getContext('2d')!
    const preset = PRESETS[wallpaper] ?? PRESETS.meadow
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let dpr = 1
    const pointer = { x: -9999, y: -9999 }

    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const newBubble = (anywhere: boolean): Bubble => {
      const r = Math.random() < 0.15 ? rand(18, 34) : rand(4, 14)
      return { x: rand(0, w), y: anywhere ? rand(0, h) : h + r + rand(0, 80), r, vy: (rand(14, 32) + r * 0.8) * preset.speed, phase: rand(0, Math.PI * 2), wobble: rand(4, 14), popping: 0 }
    }
    const bubbles: Bubble[] = Array.from({ length: preset.bubbles }, () => newBubble(true))
    const orbs: Orb[] = Array.from({ length: preset.bokeh }, () => ({
      x: rand(0, w),
      y: rand(h * 0.15, h),
      r: rand(18, 70),
      vx: rand(-4, 4),
      vy: rand(-3, 1),
      hue: preset.warm ? rand(38, 70) : rand(170, 210),
      a: rand(0.06, 0.16)
    }))
    const sparks: Spark[] = Array.from({ length: preset.sparkles }, () => ({
      x: rand(0, w),
      y: wallpaper === 'aurora' ? rand(0, h * 0.55) : rand(0, h * 0.7),
      s: rand(2, wallpaper === 'aurora' ? 4 : 7),
      t: rand(0, Math.PI * 2),
      speed: rand(0.6, 1.6)
    }))
    const rings: { x: number; y: number; r: number; t: number }[] = []

    const drawBubble = (b: Bubble, x: number) => {
      const { y, r } = b
      if (b.popping > 0) {
        // Burst: a thin expanding ring and a few droplets.
        const p = b.popping
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - p)})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(x, y, r * (1 + p * 0.8), 0, Math.PI * 2)
        ctx.stroke()
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + b.phase
          const d = r * (1 + p * 1.6)
          ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - p)})`
          ctx.beginPath()
          ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.4, 0, Math.PI * 2)
          ctx.fill()
        }
        return
      }
      // Body: almost clear, with a faint cyan tint toward the rim.
      const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
      body.addColorStop(0, 'rgba(255,255,255,0.05)')
      body.addColorStop(0.7, 'rgba(190,240,255,0.06)')
      body.addColorStop(0.92, 'rgba(210,248,255,0.32)')
      body.addColorStop(1, 'rgba(255,255,255,0.55)')
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      // Iridescent film: a thin coloured arc along the lower rim.
      ctx.lineWidth = Math.max(0.8, r * 0.07)
      const film = ctx.createLinearGradient(x - r, y, x + r, y + r)
      film.addColorStop(0, 'rgba(120,255,220,0.0)')
      film.addColorStop(0.4, 'rgba(120,255,220,0.35)')
      film.addColorStop(0.7, 'rgba(255,170,240,0.3)')
      film.addColorStop(1, 'rgba(255,240,150,0.0)')
      ctx.strokeStyle = film
      ctx.beginPath()
      ctx.arc(x, y, r * 0.93, Math.PI * 0.15, Math.PI * 0.95)
      ctx.stroke()
      // Specular highlight: the window of light every bubble reflects.
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      ctx.arc(x + r * 0.42, y + r * 0.38, r * 0.07, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawSpark = (s: Spark, now: number) => {
      const tw = (Math.sin(now * 0.001 * s.speed + s.t) + 1) / 2
      const size = s.s * (0.4 + tw * 0.8)
      const a = 0.25 + tw * 0.7
      ctx.save()
      ctx.translate(s.x, s.y)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.4)
      g.addColorStop(0, `rgba(255,255,255,${a * 0.7})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, size * 2.4, 0, Math.PI * 2)
      ctx.fill()
      // Four-point star: the lens-flare sparkle.
      ctx.fillStyle = `rgba(255,255,255,${a})`
      ctx.beginPath()
      ctx.moveTo(0, -size * 2)
      ctx.quadraticCurveTo(size * 0.18, -size * 0.18, size * 2, 0)
      ctx.quadraticCurveTo(size * 0.18, size * 0.18, 0, size * 2)
      ctx.quadraticCurveTo(-size * 0.18, size * 0.18, -size * 2, 0)
      ctx.quadraticCurveTo(-size * 0.18, -size * 0.18, 0, -size * 2)
      ctx.fill()
      ctx.restore()
    }

    let last = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, w, h)

      ctx.globalCompositeOperation = 'screen'
      for (const o of orbs) {
        o.x += o.vx * dt
        o.y += o.vy * dt
        if (o.x < -80) o.x = w + 80
        if (o.x > w + 80) o.x = -80
        if (o.y < -80) o.y = h + 80
        if (o.y > h + 80) o.y = -80
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        g.addColorStop(0, `hsla(${o.hue}, 90%, 85%, ${o.a})`)
        g.addColorStop(0.7, `hsla(${o.hue}, 90%, 80%, ${o.a * 0.7})`)
        g.addColorStop(1, `hsla(${o.hue}, 90%, 80%, 0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      for (const s of sparks) drawSpark(s, now)

      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i]
        if (b.popping > 0) {
          b.popping += dt * 3.2
          if (b.popping >= 1) bubbles[i] = newBubble(false)
        } else {
          b.y -= b.vy * dt
          b.phase += dt * 1.6
          // Bubbles shy away from the pointer, like a hand moved through water.
          const dx = b.x - pointer.x
          const dy = b.y - pointer.y
          const d2 = dx * dx + dy * dy
          if (d2 < 140 * 140) {
            const f = (1 - Math.sqrt(d2) / 140) * 60 * dt
            b.x += (dx >= 0 ? 1 : -1) * f
          }
          if (b.y < -b.r - 20) bubbles[i] = newBubble(false)
        }
        drawBubble(b, b.x + Math.sin(b.phase) * b.wobble)
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]
        r.t += dt * 1.6
        if (r.t >= 1) {
          rings.splice(i, 1)
          continue
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - r.t)})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.r + r.t * 40, (r.r + r.t * 40) * 0.35, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      if (!still) raf = requestAnimationFrame(frame)
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !still) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    const onLeave = () => {
      pointer.x = pointer.y = -9999
    }
    const onDown = (e: PointerEvent) => {
      // Only clicks on open background pop bubbles, never clicks on controls.
      const t = e.target as HTMLElement
      if (t.closest('button, a, input, textarea, select, form, .gadget, .ntp-panel, .tiles')) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      for (const b of bubbles) {
        const bx = b.x + Math.sin(b.phase) * b.wobble
        if (!b.popping && (bx - x) ** 2 + (b.y - y) ** 2 <= (b.r + 6) ** 2) {
          b.popping = 0.001
          if (soundRef.current) playSound('pop')
          return
        }
      }
      // Missed: a ripple where the water was touched.
      rings.push({ x, y, r: 6, t: 0 })
    }
    const host = canvas.parentElement!
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    document.addEventListener('visibilitychange', onVisibility)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('pointerdown', onDown)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('pointerdown', onDown)
    }
  }, [wallpaper, enabled])

  if (!enabled) return null
  return <canvas ref={ref} className="ntp-ambient" aria-hidden />
}
