/**
 * Minimal synthesized sound system — no assets, WebAudio only.
 * Each event is a short geometric blip; everything routes through a master
 * gain so a global toggle silences the app instantly.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = true

export function setSoundEnabled(on: boolean) {
  enabled = on
}

function ensure(): AudioContext | null {
  if (!enabled) return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.28
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/**
 * Mobile browsers only allow audio started inside a user gesture. Many of our
 * sounds fire from state changes (AI tiles landing, score pops), so unlock
 * the context on the very first touch: resume it and play one silent sample.
 */
function unlock() {
  try {
    const c = ensure()
    if (!c) return
    if (c.state === 'suspended') void c.resume()
    const buf = c.createBuffer(1, 1, 22050)
    const src = c.createBufferSource()
    src.buffer = buf
    src.connect(c.destination)
    src.start(0)
  } catch {
    /* stay silent */
  }
  window.removeEventListener('pointerdown', unlock, true)
  window.removeEventListener('touchend', unlock, true)
}
window.addEventListener('pointerdown', unlock, true)
window.addEventListener('touchend', unlock, true)

function tone(freq: number, dur: number, opts: { type?: OscillatorType; at?: number; gain?: number; slide?: number } = {}) {
  const c = ensure()
  if (!c || !master) return
  const t0 = c.currentTime + (opts.at ?? 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + opts.slide), t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(opts.gain ?? 0.9, t0 + 0.006)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export const sfx = {
  select: () => tone(760, 0.07, { type: 'triangle', gain: 0.5 }),
  deselect: () => tone(520, 0.06, { type: 'triangle', gain: 0.35 }),
  place: () => {
    tone(190, 0.09, { type: 'sine', gain: 1, slide: -80 })
    tone(950, 0.03, { type: 'square', gain: 0.12 })
  },
  draw: () => tone(430, 0.08, { type: 'triangle', gain: 0.45, slide: 120 }),
  pass: () => tone(240, 0.16, { type: 'sine', gain: 0.5, slide: -60 }),
  score: () => {
    tone(660, 0.1, { type: 'triangle', gain: 0.6 })
    tone(990, 0.14, { type: 'triangle', gain: 0.6, at: 0.09 })
  },
  turn: () => tone(560, 0.05, { type: 'sine', gain: 0.25 }),
  win: () => {
    tone(523, 0.12, { type: 'triangle', gain: 0.6 })
    tone(659, 0.12, { type: 'triangle', gain: 0.6, at: 0.11 })
    tone(784, 0.22, { type: 'triangle', gain: 0.7, at: 0.22 })
  },
  lose: () => {
    tone(330, 0.16, { type: 'sine', gain: 0.55 })
    tone(233, 0.3, { type: 'sine', gain: 0.55, at: 0.15 })
  },
}
