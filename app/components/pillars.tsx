'use client'

import { ParticleImage } from './particle-image'

/* Pillars of Creation (Eagle Nebula, M16) — NASA / ESA / CSA / STScI, JWST
   NIRCam 2022 (public NASA imagery), as an explorable particle volume.
   Landscape screens get a native 16:9 crop; portrait gets the tall original. */

export function Pillars() {
  return (
    <ParticleImage
      src={{
        landscape: '/misc/pillars-wide.jpg',
        portrait: '/misc/pillars.jpg',
      }}
    />
  )
}
