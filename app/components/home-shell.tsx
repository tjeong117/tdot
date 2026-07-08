'use client'

import { useEffect, useRef, useState } from 'react'
import { ParticleImage } from './particle-image'

/* Home scrollytelling: the right rail snaps one card per scroll gesture;
   when the active card changes, the left panel crossfades to that card's
   nebula at full reconstruction quality. The panel is fully interactive —
   drag to pan, wheel to zoom, hover to tilt. */

export type Scene = {
  key: string // scenes with the same key don't retrigger a crossfade
  src: string | null // null = the theme starfield (the sky card)
  caption: string
}

type Layer = { id: number; scene: Scene }

const STAR_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='17' cy='36' r='0.9' opacity='.6'/%3E%3Ccircle cx='63' cy='11' r='0.7' opacity='.4'/%3E%3Ccircle cx='104' cy='58' r='1' opacity='.5'/%3E%3Ccircle cx='151' cy='24' r='0.6' opacity='.35'/%3E%3Ccircle cx='196' cy='73' r='0.8' opacity='.45'/%3E%3Ccircle cx='38' cy='104' r='0.7' opacity='.4'/%3E%3Ccircle cx='87' cy='139' r='0.9' opacity='.55'/%3E%3Ccircle cx='139' cy='112' r='0.6' opacity='.3'/%3E%3Ccircle cx='183' cy='151' r='1' opacity='.5'/%3E%3Ccircle cx='226' cy='118' r='0.6' opacity='.3'/%3E%3Ccircle cx='22' cy='176' r='0.8' opacity='.42'/%3E%3Ccircle cx='68' cy='212' r='0.6' opacity='.32'/%3E%3Ccircle cx='121' cy='188' r='0.9' opacity='.5'/%3E%3Ccircle cx='171' cy='226' r='0.7' opacity='.36'/%3E%3Ccircle cx='213' cy='196' r='0.6' opacity='.3'/%3E%3C/g%3E%3Cg fill='%23ffc46b'%3E%3Ccircle cx='132' cy='16' r='0.8' opacity='.45'/%3E%3Ccircle cx='51' cy='158' r='0.7' opacity='.4'/%3E%3C/g%3E%3C/svg%3E\")"

export function HomeShell({
  scenes,
  children,
}: {
  scenes: Scene[]
  children: React.ReactNode
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)
  const [layers, setLayers] = useState<Layer[]>(() => [
    { id: 0, scene: scenes[0] },
  ])
  const nextId = useRef(1)
  const currentKey = useRef(scenes[0]?.key)
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // warm the browser cache so crossfades never wait on the network
  useEffect(() => {
    for (const s of scenes) {
      if (s.src) {
        const img = new Image()
        img.src = s.src
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // drop covered layers once the top one has faded in
  useEffect(() => {
    if (layers.length > 1) {
      const t = setTimeout(() => setLayers((prev) => prev.slice(-1)), 2000)
      return () => clearTimeout(t)
    }
  }, [layers])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const cards = Array.from(rail.querySelectorAll('[data-card]'))
    const indexOf = new Map(cards.map((c, i) => [c, i]))
    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null
        for (const entry of entries) {
          entry.target.classList.toggle('card-active', entry.isIntersecting)
          if (
            entry.isIntersecting &&
            (!best || entry.intersectionRatio > best.intersectionRatio)
          ) {
            best = entry
          }
        }
        if (!best) return
        const index = indexOf.get(best.target) ?? 0
        setActive(index)
        // settle briefly so flinging through cards doesn't build every scene
        if (switchTimer.current) clearTimeout(switchTimer.current)
        switchTimer.current = setTimeout(() => {
          const scene = scenes[index]
          if (!scene || scene.key === currentKey.current) return
          currentKey.current = scene.key
          setLayers((prev) => [
            ...prev.slice(-1),
            { id: nextId.current++, scene },
          ])
        }, 220)
      },
      { root: rail, threshold: 0.5 }
    )
    cards.forEach((card) => observer.observe(card))
    return () => {
      observer.disconnect()
      if (switchTimer.current) clearTimeout(switchTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-30 bg-black text-white">
      <div className="absolute inset-0 md:right-1/2">
        {layers.map((layer) => (
          <div key={layer.id} className="absolute inset-0">
            {layer.scene.src ? (
              <ParticleImage
                variant="panel"
                src={layer.scene.src}
                sampleWidth={2600}
              />
            ) : (
              <div
                className="panel-starfield absolute inset-0"
                style={{ backgroundImage: STAR_TILE }}
              />
            )}
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 px-6 md:px-10 [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_14px_rgba(0,0,0,0.8)]">
          <h1 className="text-3xl font-semibold tracking-tighter md:text-4xl">
            Tom Jeong
          </h1>
          <p
            key={active}
            className="caption-fade font-readout mt-2 text-neutral-400"
          >
            {scenes[active]?.caption}
          </p>
        </div>
      </div>
      <div
        ref={railRef}
        className="absolute inset-0 md:left-1/2 snap-y snap-mandatory overflow-y-auto"
      >
        {children}
      </div>
      <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col items-end md:right-3">
        {scenes.map((scene, i) => (
          <button
            key={i}
            type="button"
            aria-label={`section ${i + 1} of ${scenes.length}`}
            aria-current={i === active}
            className="cursor-pointer py-[3px] pl-3"
            onClick={() => {
              const card = railRef.current?.querySelectorAll('[data-card]')[i]
              card
                ?.closest('section')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            <span
              className={`rail-tick${i === active ? ' rail-tick-active' : ''}`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
