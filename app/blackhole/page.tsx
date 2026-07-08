import Link from 'next/link'
import { Gargantua } from 'app/components/gargantua'

export const metadata = {
  title: 'Accretion',
  description:
    "NASA's black hole visualization rebuilt as an orbiting particle volume — the inner disk outruns the outer, and the lensed halo swirls.",
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
            {`NASA's 2019 black hole visualization, rebuilt particle by particle and set in motion. Every point rides a Keplerian orbit — the inner disk visibly outruns the outer — and the glow arcing over and under the shadow is the far side of the disk, gravitationally lensed into view.`}
          </p>
          <p className="font-readout text-neutral-400">
            drag to pan · scroll to zoom · move your cursor — imagery: NASA
            GSFC / Jeremy Schnittman, 2019
          </p>
        </div>
      </div>
    </div>
  )
}
