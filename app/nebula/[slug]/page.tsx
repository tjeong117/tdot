import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ParticleImage,
  type ParticleImageProps,
} from 'app/components/particle-image'

type Artifact = {
  title: string
  blurb: string
  credit: string
  options: ParticleImageProps
}

export const ARTIFACTS: Record<string, Artifact> = {
  carina: {
    title: 'Cosmic Cliffs',
    blurb:
      "The edge of NGC 3324 in the Carina Nebula — a wall of gas seven light-years tall, sculpted by ultraviolet radiation from newborn stars above it.",
    credit: 'NASA, ESA, CSA, STScI — JWST NIRCam, 2022',
    options: { src: '/misc/carina.jpg' },
  },
  'southern-ring': {
    title: 'Southern Ring',
    blurb:
      'NGC 3132 — a dying star flinging off its outer layers in shells of gas and dust, with the white dwarf that made them visible at the center.',
    credit: 'NASA, ESA, CSA, STScI — JWST NIRCam, 2022',
    options: { src: '/misc/southern-ring.jpg' },
  },
  tarantula: {
    title: 'Tarantula Nebula',
    blurb:
      '30 Doradus — the most violent star-forming region in the Local Group, 161,000 light-years away, with tens of thousands of young stars burning through their cocoon.',
    credit: 'NASA, ESA, CSA, STScI — JWST NIRCam, 2022',
    options: { src: '/misc/tarantula.jpg' },
  },
  'ring-nebula': {
    title: 'Ring Nebula',
    blurb:
      "M57 — a sunlike star's final act, 2,500 light-years away: shells of ejected gas around a collapsing core, caught face-on so the barrel of the explosion looks like a ring.",
    credit: 'ESA/Webb, NASA, CSA, STScI — JWST NIRCam, 2023',
    options: { src: '/misc/ring-nebula.jpg' },
  },
  'cats-eye': {
    title: "Cat's Eye",
    blurb:
      'NGC 6543 — eleven concentric shells thrown off in 1,500-year convulsions, with the dying star still burning hot enough at the center to glow in X-rays.',
    credit: 'NASA, ESA, CXC, HST — Hubble & Chandra composite',
    options: { src: '/misc/cats-eye.jpg' },
  },
  helix: {
    title: 'Helix Nebula',
    blurb:
      'NGC 7293 — the nearest bright planetary nebula to Earth, a trillion-mile-wide eye of glowing gas whose inner edge is being evaporated by the white dwarf at its pupil.',
    credit: "NASA, ESA, C.R. O'Dell — Hubble & CTIO, 2004",
    options: { src: '/misc/helix.jpg' },
  },
  butterfly: {
    title: 'Butterfly Nebula',
    blurb:
      'NGC 6302 — wings of gas heated to 20,000 degrees tearing outward at over 600,000 miles an hour, from a star that was once five times the mass of the Sun.',
    credit: 'NASA, ESA, Hubble SM4 ERO Team — Hubble WFC3, 2009',
    options: { src: '/misc/butterfly.jpg' },
  },
  crab: {
    title: 'Crab Nebula',
    blurb:
      'M1 — the wreckage of a supernova witnessed in 1054, a cage of glowing filaments around a pulsar spinning thirty times a second.',
    credit: 'NASA, ESA, CSA, STScI, T. Temim — JWST MIRI & NIRCam, 2024',
    options: { src: '/misc/crab.jpg' },
  },
  'deep-field': {
    title: 'Deep Field',
    blurb:
      "Webb's First Deep Field — galaxy cluster SMACS 0723, thousands of galaxies in a patch of sky the size of a grain of sand at arm's length. Every galaxy here sits on its own depth layer: zoom in and fall billions of years into the frame.",
    credit: 'NASA, ESA, CSA, STScI — JWST NIRCam, 2022',
    options: {
      src: '/misc/deep-field.jpg',
      exposure: 0.8,
      lumThreshold: 0.085,
      depth: 'galaxies',
    },
  },
}

export function generateStaticParams() {
  return Object.keys(ARTIFACTS).map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const artifact = ARTIFACTS[slug]
  if (!artifact) return {}
  return {
    title: artifact.title,
    description: `${artifact.blurb.slice(0, 150)} — rebuilt as an explorable particle volume.`,
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const artifact = ARTIFACTS[slug]
  if (!artifact) notFound()

  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-black text-white">
      <ParticleImage {...artifact.options} />
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
            {artifact.title}
          </h1>
          <p className="text-neutral-300 mb-3">{artifact.blurb}</p>
          <p className="font-readout text-neutral-400">
            drag to pan · scroll to zoom · move your cursor — imagery:{' '}
            {artifact.credit}
          </p>
        </div>
      </div>
    </div>
  )
}
