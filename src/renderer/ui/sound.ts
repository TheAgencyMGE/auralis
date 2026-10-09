// Aero sounds: recorded samples from Kenney's Interface Sounds (CC0),
// shipped in public/sounds. Quiet by design.
export type SoundName = 'drop' | 'chime'

const cache = new Map<SoundName, HTMLAudioElement>()

export function playSound(name: SoundName): void {
  let el = cache.get(name)
  if (!el) {
    el = new Audio(`/sounds/${name}.ogg`)
    el.volume = 0.45
    cache.set(name, el)
  }
  el.currentTime = 0
  void el.play().catch(() => {})
}
