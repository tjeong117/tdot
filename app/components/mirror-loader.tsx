'use client'

import { useEffect, useState } from 'react'

/* JWST's primary mirror: 18 hexagonal gold segments in two rings around an
   empty center. Segments fly in one by one while a particle reconstruction
   is being built, then the whole thing fades away. */

const HEX_CLIP = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'

function segments() {
  const cells: { q: number; r: number }[] = []
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      const dist = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2
      if (dist === 1 || dist === 2) cells.push({ q, r })
    }
  }
  return cells
}

export function MirrorLoader({ done }: { done: boolean }) {
  const [assembled, setAssembled] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setAssembled(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const s = 22 // segment radius in px
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${
        done ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative" style={{ width: s * 7, height: s * 7 }}>
        {segments().map(({ q, r }, i) => (
          <div
            key={`${q},${r}`}
            className="absolute transition-all duration-500 ease-out"
            style={{
              width: s * 2,
              height: s * Math.sqrt(3),
              left: s * 3.5 + s * 1.5 * q - s,
              top: s * 3.5 + s * Math.sqrt(3) * (r + q / 2) - (s * Math.sqrt(3)) / 2,
              clipPath: HEX_CLIP,
              background:
                'linear-gradient(135deg, #ffd98a 0%, #c9a24b 55%, #8a6117 100%)',
              opacity: assembled ? 0.95 : 0,
              transform: assembled
                ? 'scale(0.96) rotate(0deg)'
                : 'scale(0.2) rotate(60deg)',
              transitionDelay: `${i * 55}ms`,
            }}
          />
        ))}
      </div>
      <p className="font-readout mt-8 text-neutral-500">
        assembling primary mirror…
      </p>
    </div>
  )
}
