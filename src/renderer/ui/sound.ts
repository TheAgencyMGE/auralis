// Aero sounds: recorded samples, shipped in public/sounds. Quiet by design.
// drop and chime: Kenney's Interface Sounds (CC0). startup: "Wind chime
// small" from Pixabay (Pixabay Content License), trimmed to seven seconds.
export type SoundName = 'drop' | 'chime' | 'startup'

const FILES: Record<SoundName, string> = { drop: 'drop.ogg', chime: 'chime.ogg', startup: 'startup.mp3' }
const cache = new Map<SoundName, HTMLAudioElement>()

export function playSound(name: SoundName): void {
  if (!(name in FILES)) return
  let el = cache.get(name)
  if (!el) {
    el = new Audio(`/sounds/${FILES[name]}`)
    cache.set(name, el)
  }
  el.volume = name === 'startup' ? 0.35 : 0.45
  el.currentTime = 0
  void el.play().catch(() => {})
  if (name === 'startup') {
    // Let the chime ring, then fade it out over the last two seconds and let the element go.
    const a = el
    window.setTimeout(() => {
      const fade = window.setInterval(() => {
        a.volume = Math.max(0, a.volume - 0.035)
        if (a.volume === 0) {
          window.clearInterval(fade)
          a.pause()
          cache.delete('startup')
        }
      }, 200)
    }, 4800)
  }
}
