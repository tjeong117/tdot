import Link from 'next/link'
import { Collision } from 'app/components/collision'

export const metadata = {
  title: 'Collision',
  description:
    'The Milky Way–Andromeda merger as a live restricted N-body simulation: two cores, twenty-six thousand stars, real tidal tails, and a timeline you can scrub.',
}

export default function Page() {
  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-black text-white">
      <Collision />
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 md:p-10">
        <nav className="pointer-events-auto flex flex-row space-x-4 self-start text-neutral-300 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
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
            Collision
          </h1>
          <p className="text-neutral-300 mb-3">
            {`Andromeda is falling toward the Milky Way at 110 km/s, and in a few billion years they will merge. This is that future, simulated live: the two cores are real point masses, every star is a test particle in their combined gravity — the cheapest simulation that still grows genuine tidal tails (Toomre & Toomre, 1972). Gold is us, blue is Andromeda.`}
          </p>
          <p className="font-readout text-neutral-400">
            drag to orbit · scroll to zoom · scrub or play the timeline —
            timescale compressed; the real thing is gentler
          </p>
        </div>
      </div>
    </div>
  )
}
