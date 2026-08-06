'use client'

import dynamic from 'next/dynamic'

// three.js stays out of the server render and the initial HTML
const ParticleLogo = dynamic(
  () => import('./particle-logo').then((m) => m.ParticleLogo),
  { ssr: false, loading: () => <div className="particle-logo" /> }
)

export function Logo() {
  return (
    <header>
      <ParticleLogo src="/misc/tarantula.jpg" />
    </header>
  )
}
