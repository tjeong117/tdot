import { Sky } from 'app/components/sky'

export const metadata = {
  title: 'Sky',
  description:
    'A realistic constellation atlas — 2,000 real stars at their true positions, with the classical figures traced between them.',
}

export default function Page() {
  return (
    <section>
      <h1 className="ring-rule font-semibold text-2xl mb-8 tracking-tighter">
        Constellation Atlas
      </h1>
      <p className="mb-4">
        {`The night sky as the ancients drew it. Every star brighter than magnitude 5 — about two thousand of them — sits at its true right ascension and declination from the HYG catalog, colored by its actual temperature, from blue-white giants to deep orange embers.`}
      </p>
      <p className="mb-8">
        {`Traced between them are the hands the Greeks saw: all 88 classical figures, from Orion the hunter to Andromeda the chained queen. You're standing at the center of the celestial sphere — drag to pan across it, scroll to zoom into a figure.`}
      </p>
      <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 md:px-8">
        <div className="mx-auto max-w-[1150px]">
          <Sky />
        </div>
      </div>
    </section>
  )
}
