'use client'

import { useEffect, useRef, useState } from 'react'

/* A real split-step propagator, not an animation of one. Each frame does what
   one kinetic half-step of the mixer does: FFT along the sequence, multiply by
   the unit-modulus phase plate exp(-i ω(k) dt), inverse FFT. Because the
   multiplier has modulus 1 the total energy is conserved exactly: packets
   translate, spread and skew, but nothing is created or destroyed. Phase is
   drawn as hue, amplitude as brightness, which is what makes interference
   legible: where two packets meet, hue banding is the fringe pattern. */

const N = 256 // sequence grid, power of two for the radix-2 transform
const HIST = 190 // waterfall rows

// ---- minimal iterative radix-2 FFT (in place, sign = -1 forward) ----
const rev = new Uint16Array(N)
for (let i = 0, bits = Math.log2(N); i < N; i++) {
  let r = 0
  for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b)
  rev[i] = r
}

function fft(re: Float64Array, im: Float64Array, sign: number) {
  for (let i = 0; i < N; i++) {
    const j = rev[i]
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t
      t = im[i]; im[i] = im[j]; im[j] = t
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < N; i += len) {
      let cr = 1
      let ci = 0
      for (let j = 0; j < len / 2; j++) {
        const ar = re[i + j]
        const ai = im[i + j]
        const br = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci
        const bi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr
        re[i + j] = ar + br
        im[i + j] = ai + bi
        re[i + j + len / 2] = ar - br
        im[i + j + len / 2] = ai - bi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
  if (sign > 0) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N }
}

// k = 2π · fftfreq(N), exactly the grid the mixer learns its coefficients on
const K = new Float64Array(N)
for (let i = 0; i < N; i++) K[i] = (2 * Math.PI * (i < N / 2 ? i : i - N)) / N

type Preset = 'interference' | 'single'

function seed(preset: Preset) {
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  const packet = (centre: number, width: number, momentum: number) => {
    for (let x = 0; x < N; x++) {
      const d = x - centre
      const a = Math.exp(-(d * d) / (2 * width * width))
      re[x] += a * Math.cos(momentum * d)
      im[x] += a * Math.sin(momentum * d)
    }
  }
  if (preset === 'interference') {
    packet(N * 0.3, 14, 0.55)
    packet(N * 0.7, 14, -0.55)
  } else {
    packet(N * 0.5, 12, 0.0)
  }
  return { re, im }
}

// phase -> hue, amplitude -> brightness. The holographic part: colour *is* the
// quantity the Born readout throws away.
function phaseColour(phase: number, amp: number) {
  const h = ((phase + Math.PI) / (2 * Math.PI)) * 360
  const l = Math.min(62, 62 * amp)
  return `hsl(${h.toFixed(0)} 92% ${l.toFixed(1)}%)`
}

export function WaveDispersion() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [a1, setA1] = useState(0)
  const [a2, setA2] = useState(1.2)
  const [a3, setA3] = useState(0)
  const [preset, setPreset] = useState<Preset>('interference')
  const [running, setRunning] = useState(true)
  const [runId, setRunId] = useState(0)

  // read live values inside the loop without restarting it
  const coeffs = useRef({ a1, a2, a3 })
  coeffs.current = { a1, a2, a3 }
  const isRunning = useRef(running)
  isRunning.current = running

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.clientWidth
    const H = 260
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let { re, im } = seed(preset)
    const history: string[][] = []
    let frame = 0
    let age = 0
    const LOOP = 520 // steps before reseeding, so the collision replays
    const dt = 0.035
    const bandH = 54
    const rowH = (H - bandH) / HIST

    const step = () => {
      const { a1, a2, a3 } = coeffs.current
      fft(re, im, -1)
      for (let i = 0; i < N; i++) {
        const k = K[i]
        const w = (a1 * k + a2 * k * k + a3 * k * k * k) * dt
        const c = Math.cos(-w)
        const s = Math.sin(-w)
        const r = re[i] * c - im[i] * s
        im[i] = re[i] * s + im[i] * c
        re[i] = r
      }
      fft(re, im, 1)
    }

    const draw = () => {
      let peak = 1e-9
      for (let x = 0; x < N; x++) {
        const m = Math.hypot(re[x], im[x])
        if (m > peak) peak = m
      }

      const row: string[] = new Array(N)
      for (let x = 0; x < N; x++) {
        row[x] = phaseColour(Math.atan2(im[x], re[x]), Math.hypot(re[x], im[x]) / peak)
      }
      history.unshift(row)
      if (history.length > HIST) history.pop()

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)

      // live band: phase as hue across the sequence
      const cw = W / N
      for (let x = 0; x < N; x++) {
        ctx.fillStyle = row[x]
        ctx.fillRect(x * cw, 0, cw + 0.6, bandH)
      }

      // amplitude trace over the band
      ctx.beginPath()
      for (let x = 0; x < N; x++) {
        const m = Math.hypot(re[x], im[x]) / peak
        const y = bandH - m * (bandH - 6) - 3
        if (x === 0) ctx.moveTo(0, y)
        else ctx.lineTo(x * cw, y)
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.92)'
      ctx.lineWidth = 1.25
      ctx.stroke()

      // waterfall: every past step, newest just under the band
      for (let r = 0; r < history.length; r++) {
        const hr = history[r]
        const y = bandH + r * rowH
        for (let x = 0; x < N; x++) {
          ctx.fillStyle = hr[x]
          ctx.fillRect(x * cw, y, cw + 0.6, rowH + 0.6)
        }
      }

      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '10px ui-monospace, monospace'
      ctx.fillText('now', 6, bandH + 12)
      ctx.fillText('↓ time', 6, H - 8)
    }

    let raf = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!isRunning.current) return
      frame++
      if (reduced && frame % 3 !== 0) return
      if (++age > LOOP) {
        const fresh = seed(preset)
        re = fresh.re
        im = fresh.im
        age = 0
      }
      step()
      draw()
    }
    draw()
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [preset, runId])

  const slider = (
    label: string,
    value: number,
    set: (v: number) => void,
    min: number,
    max: number,
    note: string
  ) => (
    <label className="wave-control">
      <span className="wave-label">
        {label} <span className="wave-note">{note}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => set(parseFloat(e.target.value))}
      />
      <span className="wave-value">{value.toFixed(2)}</span>
    </label>
  )

  return (
    <div className="wave-demo">
      <canvas ref={canvasRef} className="wave-canvas" />
      <div className="wave-controls">
        {slider('a₁', a1, setA1, -3, 3, 'advection, moves')}
        {slider('a₂', a2, setA2, -4, 4, 'Schrödinger, spreads')}
        {slider('a₃', a3, setA3, -6, 6, 'Airy, skews')}
      </div>
      <div className="wave-buttons">
        <button
          type="button"
          onClick={() => setPreset('interference')}
          aria-pressed={preset === 'interference'}
          className={preset === 'interference' ? 'on' : ''}
        >
          two packets
        </button>
        <button
          type="button"
          onClick={() => setPreset('single')}
          aria-pressed={preset === 'single'}
          className={preset === 'single' ? 'on' : ''}
        >
          one packet
        </button>
        <button type="button" onClick={() => setRunning((r) => !r)}>
          {running ? 'pause' : 'play'}
        </button>
        <button type="button" onClick={() => setRunId((n) => n + 1)}>
          reset
        </button>
      </div>
    </div>
  )
}
