'use client'

import { useEffect, useRef } from 'react'

/* Scroll rail for the home page: cards snap into view and light up as they
   cross the viewport, via an IntersectionObserver toggling .card-active. */

export function HomeCards({ children }: { children: React.ReactNode }) {
  const railRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('card-active', entry.isIntersecting)
        }
      },
      { root: rail, threshold: 0.35 }
    )
    rail.querySelectorAll('[data-card]').forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={railRef}
      className="absolute inset-0 md:left-1/2 overflow-y-auto snap-y snap-proximity"
    >
      {children}
    </div>
  )
}
