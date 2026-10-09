// The aquarium gadget: a little glass tank of fish, the most "Aqua" thing a
// Frutiger Aero desktop ever had. Click the water to feed them.
import { useEffect, useRef } from 'react'
import { playSound } from '@ui/sound'

interface Species {
  name: string
  len: number
  body: [string, string]
  fin: string
  pattern?: 'koi' | 'clown' | 'tang' | 'neon'
  speed: number
}

const SPECIES: Species[] = [
  { name: 'koi', len: 34, body: ['#ffffff', '#f6f0e8'], fin: 'rgba(255,240,230,0.75)', pattern: 'koi', speed: 26 },
  { name: 'tang', len: 28, body: ['#3d8bff', '#1340b8'], fin: 'rgba(40,90,220,0.8)', pattern: 'tang', speed: 34 },
  { name: 'clown', len: 22, body: ['#ff9a3c', '#e8590c'], fin: 'rgba(255,140,60,0.85)', pattern: 'clown', speed: 30 },
  { name: 'neon', len: 13, body: ['#9be7ff', '#2a6fd6'], fin: 'rgba(160,220,255,0.6)', pattern: 'neon', speed: 44 },
  { name: 'neon', len: 12, body: ['#9be7ff', '#2a6fd6'], fin: 'rgba(160,220,255,0.6)', pattern: 'neon', speed: 46 }
]

interface Fish {
  sp: Species
  x: number
  y: number
  vx: number
  vy: number
  tx: number
  ty: number
  tail: number
  facing: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

export function AquariumGadget({ sound }: { sound: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const W = 214
    const H = 140
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sand = H - 16

    const fish: Fish[] = SPECIES.map((sp) => {
      const x = rand(30, W - 30)
      const y = rand(20, sand - 20)
      return { sp, x, y, vx: rand(-10, 10), vy: 0, tx: rand(20, W - 20), ty: rand(18, sand - 14), tail: rand(0, 6), facing: 1 }
    })
    const food: { x: number; y: number }[] = []
    const bubbles: { x: number; y: number; r: number; p: number }[] = []
    const weeds = [18, 34, 168, 190, 200].map((x, i) => ({ x, h: rand(34, 62), p: i * 1.3, hue: rand(105, 140) }))
    const pebbles = Array.from({ length: 26 }, () => ({ x: rand(0, W), y: rand(sand + 3, H - 2), r: rand(1.4, 3.4), l: rand(55, 80) }))

    const drawFish = (f: Fish) => {
      const { sp } = f
      const L = sp.len
      const sway = Math.sin(f.tail) * 0.35
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.scale(f.facing, 1)
      ctx.rotate(Math.max(-0.4, Math.min(0.4, f.vy / 60)))
      // Tail fin, swaying.
      ctx.fillStyle = sp.fin
      ctx.beginPath()
      ctx.moveTo(-L * 0.42, 0)
      ctx.quadraticCurveTo(-L * 0.62, -L * 0.1 + sway * 6, -L * 0.78, -L * 0.28 + sway * 8)
      ctx.quadraticCurveTo(-L * 0.66, sway * 4, -L * 0.78, L * 0.28 + sway * 8)
      ctx.quadraticCurveTo(-L * 0.62, L * 0.1 + sway * 6, -L * 0.42, 0)
      ctx.fill()
      // Dorsal fin.
      ctx.beginPath()
      ctx.moveTo(-L * 0.15, -L * 0.17)
      ctx.quadraticCurveTo(L * 0.02, -L * 0.36, L * 0.14, -L * 0.17)
      ctx.fill()
      // Body.
      const g = ctx.createLinearGradient(0, -L * 0.22, 0, L * 0.22)
      g.addColorStop(0, sp.body[0])
      g.addColorStop(1, sp.body[1])
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(L * 0.5, 0)
      ctx.bezierCurveTo(L * 0.42, -L * 0.24, -L * 0.2, -L * 0.24, -L * 0.45, 0)
      ctx.bezierCurveTo(-L * 0.2, L * 0.24, L * 0.42, L * 0.24, L * 0.5, 0)
      ctx.fill()
      ctx.save()
      ctx.clip()
      if (sp.pattern === 'koi') {
        ctx.fillStyle = '#ff5a1f'
        ctx.beginPath()
        ctx.ellipse(L * 0.18, -L * 0.06, L * 0.16, L * 0.1, 0.3, 0, Math.PI * 2)
        ctx.ellipse(-L * 0.18, L * 0.02, L * 0.13, L * 0.09, -0.4, 0, Math.PI * 2)
        ctx.fill()
      } else if (sp.pattern === 'clown') {
        ctx.fillStyle = '#ffffff'
        for (const bx of [L * 0.22, -L * 0.05, -L * 0.33]) ctx.fillRect(bx - L * 0.045, -L, L * 0.09, L * 2)
      } else if (sp.pattern === 'tang') {
        ctx.fillStyle = '#0b1f5c'
        ctx.beginPath()
        ctx.ellipse(-L * 0.05, -L * 0.02, L * 0.24, L * 0.07, 0.15, 0, Math.PI * 2)
        ctx.fill()
      } else if (sp.pattern === 'neon') {
        ctx.fillStyle = '#ff3b6b'
        ctx.fillRect(-L * 0.45, L * 0.02, L * 0.55, L * 0.12)
        ctx.fillStyle = '#7ff6ff'
        ctx.fillRect(-L * 0.45, -L * 0.06, L * 0.8, L * 0.07)
      }
      // Gloss: every Aero object catches the light on top.
      const gl = ctx.createLinearGradient(0, -L * 0.24, 0, L * 0.05)
      gl.addColorStop(0, 'rgba(255,255,255,0.55)')
      gl.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gl
      ctx.fillRect(-L, -L, L * 2, L)
      ctx.restore()
      // Tail fin in yellow for the tang.
      if (sp.pattern === 'tang') {
        ctx.fillStyle = '#ffd43a'
        ctx.beginPath()
        ctx.moveTo(-L * 0.45, 0)
        ctx.lineTo(-L * 0.74, -L * 0.24 + sway * 8)
        ctx.lineTo(-L * 0.74, L * 0.24 + sway * 8)
        ctx.fill()
      }
      // Eye.
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(L * 0.3, -L * 0.04, Math.max(1.2, L * 0.055), 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#0a1220'
      ctx.beginPath()
      ctx.arc(L * 0.31, -L * 0.04, Math.max(0.7, L * 0.03), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    let last = performance.now()
    let raf = 0
    let bubbleClock = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000

      // Water.
      const water = ctx.createLinearGradient(0, 0, 0, H)
      water.addColorStop(0, '#5fd3f0')
      water.addColorStop(0.55, '#1d8ec7')
      water.addColorStop(1, '#0e5a93')
      ctx.fillStyle = water
      ctx.fillRect(0, 0, W, H)
      // Light shafts drifting through the water.
      ctx.globalCompositeOperation = 'screen'
      for (let i = 0; i < 4; i++) {
        const x = ((i * 70 + t * 9) % (W + 80)) - 40
        const g = ctx.createLinearGradient(x, 0, x + 30, H)
        g.addColorStop(0, 'rgba(255,255,255,0.22)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x + 18, 0)
        ctx.lineTo(x + 46, H)
        ctx.lineTo(x + 20, H)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      // Surface shimmer.
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      for (let x = 0; x < W; x += 6) ctx.fillRect(x, 2 + Math.sin(t * 2 + x * 0.15) * 1.2, 4, 1)

      // Sand and pebbles.
      const sandG = ctx.createLinearGradient(0, sand, 0, H)
      sandG.addColorStop(0, '#f4e1a8')
      sandG.addColorStop(1, '#d4b56d')
      ctx.fillStyle = sandG
      ctx.beginPath()
      ctx.moveTo(0, sand + 2)
      ctx.quadraticCurveTo(W * 0.3, sand - 3, W * 0.6, sand + 1)
      ctx.quadraticCurveTo(W * 0.85, sand + 4, W, sand)
      ctx.lineTo(W, H)
      ctx.lineTo(0, H)
      ctx.fill()
      for (const p of pebbles) {
        ctx.fillStyle = `hsl(35, 25%, ${p.l}%)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Seaweed.
      for (const w of weeds) {
        ctx.strokeStyle = `hsl(${w.hue}, 60%, 38%)`
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(w.x, sand + 4)
        const s = Math.sin(t * 1.3 + w.p) * 7
        ctx.bezierCurveTo(w.x + s, sand - w.h * 0.4, w.x - s, sand - w.h * 0.7, w.x + s * 1.2, sand - w.h)
        ctx.stroke()
        ctx.strokeStyle = `hsla(${w.hue}, 70%, 65%, 0.5)`
        ctx.lineWidth = 1.2
        ctx.stroke()
      }

      // Food sinks; fish chase the nearest flake.
      for (const f of food) f.y = Math.min(sand - 2, f.y + dt * 14)
      ctx.fillStyle = '#c96b2c'
      for (const f of food) ctx.fillRect(f.x - 1, f.y - 1, 2.4, 2.4)

      for (const f of fish) {
        let tx = f.tx
        let ty = f.ty
        let bestD = Infinity
        let best = -1
        food.forEach((p, i) => {
          const d = (p.x - f.x) ** 2 + (p.y - f.y) ** 2
          if (d < bestD) {
            bestD = d
            best = i
          }
        })
        if (best >= 0) {
          tx = food[best].x
          ty = food[best].y
          if (bestD < 36) food.splice(best, 1)
        } else if ((f.tx - f.x) ** 2 + (f.ty - f.y) ** 2 < 120) {
          f.tx = rand(16, W - 16)
          f.ty = rand(16, sand - 12)
        }
        const dx = tx - f.x
        const dy = ty - f.y
        const d = Math.hypot(dx, dy) || 1
        const speed = f.sp.speed * (best >= 0 ? 1.8 : 1)
        f.vx += ((dx / d) * speed - f.vx) * dt * 1.4
        f.vy += ((dy / d) * speed * 0.6 - f.vy) * dt * 1.4
        f.x += f.vx * dt
        f.y += f.vy * dt
        f.tail += dt * (6 + Math.abs(f.vx) * 0.2)
        if (Math.abs(f.vx) > 3) f.facing = f.vx > 0 ? 1 : -1
        drawFish(f)
      }

      // The bubbler.
      bubbleClock += dt
      if (bubbleClock > 0.22) {
        bubbleClock = 0
        bubbles.push({ x: 196 + rand(-2, 2), y: sand, r: rand(1, 2.6), p: rand(0, 6) })
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]
        b.y -= dt * (26 + b.r * 6)
        b.p += dt * 5
        if (b.y < 3) {
          bubbles.splice(i, 1)
          continue
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(b.x + Math.sin(b.p) * 1.5, b.y, b.r, 0, Math.PI * 2)
        ctx.stroke()
      }
      if (!still && !document.hidden) raf = requestAnimationFrame(frame)
    }
    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !still) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width) * W
      for (let i = 0; i < 5; i++) food.push({ x: x + rand(-8, 8), y: rand(3, 9) })
      if (soundRef.current) playSound('drop')
    }
    canvas.addEventListener('click', onClick)
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('click', onClick)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <section className="gadget aquarium" aria-label="Aquarium">
      <canvas ref={ref} className="tank" style={{ width: 214, height: 140 }} title="Click the water to feed the fish" />
    </section>
  )
}
