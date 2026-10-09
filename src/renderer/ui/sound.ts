// Aero sounds, synthesized: no audio files, nothing to license. Each is a
// short, quiet, watery tone in the spirit of Frutiger Aero's UI sounds.
export type SoundName = 'pop' | 'drop' | 'chime'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** A sine voice whose pitch glides from `from` to `to` Hz and fades out. */
function voice(a: AudioContext, at: number, from: number, to: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + dur * 0.8)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(g).connect(a.destination)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

export function playSound(name: SoundName): void {
  const a = audio()
  if (!a) return
  const t = a.currentTime + 0.01
  switch (name) {
    case 'pop':
      // A soap bubble: a tiny upward blip.
      voice(a, t, 520, 1500, 0.07, 0.07)
      voice(a, t + 0.01, 1800, 2600, 0.04, 0.025)
      break
    case 'drop':
      // A water droplet: pitch falls fast, with a faint resonant echo.
      voice(a, t, 1350, 420, 0.16, 0.09)
      voice(a, t + 0.11, 900, 520, 0.12, 0.03)
      break
    case 'chime':
      // Glass chime: two soft bell partials a fifth apart.
      voice(a, t, 1046.5, 1040, 0.9, 0.05, 'triangle')
      voice(a, t + 0.09, 1568, 1560, 1.1, 0.04, 'sine')
      voice(a, t + 0.09, 3136, 3130, 0.5, 0.01, 'sine')
      break
  }
}
