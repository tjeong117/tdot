import Link from 'next/link'
import { Gargantua } from 'app/components/gargantua'

export const metadata = {
  title: 'Accretion',
  description:
    "A true 3D black hole reconstructed from NASA's visualization — Keplerian orbits, live Doppler beaming, and a lensed halo that follows your eye.",
}

export default function Page() {
  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-black text-white">
      <Gargantua />
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 md:p-10">
        <nav className="pointer-events-auto flex flex-row space-x-4 text-neutral-300 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
          <Link href="/" className="eh-hover-bright">
            home
          </Link>
          <Link href="/misc" className="eh-hover-bright">
            misc
          </Link>
          <Link href="/sky" className="eh-hover-bright">
            sky
          </Link>
        </nav>
        <div className="max-w-xl [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_12px_rgba(0,0,0,0.8)]">
          <h1 className="ring-rule font-semibold text-2xl mb-4 tracking-tighter">
            Accretion
          </h1>
          <p className="text-neutral-300 mb-3">
            {`A real three-dimensional accretion disk, seeded from NASA's 2019 visualization: its radial colors are measured off the image, then 140,000 particles ride true Keplerian orbits — the inner disk outruns the outer. Doppler beaming is computed live, so the side rushing toward you always glows brighter, and the halo over the shadow is the disk's far side, lensed — its image follows your eye as you orbit, just as it would around a real black hole.`}
          </p>
          <p className="font-readout text-neutral-400">
            drag to orbit · scroll to approach — imagery: NASA GSFC / Jeremy
            Schnittman, 2019
          </p>
        </div>
      </div>
    </div>
  )
}
