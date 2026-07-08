import Link from 'next/link'
import { Pillars } from 'app/components/pillars'
import { formatDate, getBlogPosts } from 'app/blog/utils'

export const metadata = {
  title: 'Miscellaneous',
  description:
    'Experiments and curiosities, floating in front of the Pillars of Creation reconstructed as an interactive particle volume.',
}

export default function Page() {
  const miscPosts = getBlogPosts()
    .filter((post) => post.metadata.tag === 'misc')
    .sort(
      (a, b) =>
        new Date(b.metadata.publishedAt).getTime() -
        new Date(a.metadata.publishedAt).getTime()
    )

  return (
    // Full-viewport takeover, like the home hero: the site nav underneath is
    // unreadable over the nebula, so this page brings its own links.
    <div className="fixed inset-0 z-30 overflow-y-auto bg-black text-white">
      <Pillars />
      <div className="pointer-events-none relative z-10 mx-auto max-w-xl px-6 pt-10 pb-16">
        <nav className="pointer-events-auto mb-16 flex flex-row space-x-4 text-neutral-300 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
          <Link href="/" className="eh-hover-bright">
            home
          </Link>
          <Link href="/blog" className="eh-hover-bright">
            blog
          </Link>
          <Link href="/research" className="eh-hover-bright">
            research
          </Link>
          <Link href="/sky" className="eh-hover-bright">
            sky
          </Link>
        </nav>
        <div className="pointer-events-auto rounded-2xl bg-black/45 p-6 backdrop-blur-sm">
          <h1 className="ring-rule font-semibold text-2xl mb-6 tracking-tighter">
            Miscellaneous
          </h1>
          <p className="mb-6 text-neutral-300">
            Experiments and curiosities from outside the day job.
          </p>
          <Link className="flex flex-col space-y-1 mb-4" href="/sky">
            <div className="w-full flex flex-col md:flex-row md:items-baseline space-x-0 md:space-x-2">
              <p className="font-readout w-[110px] shrink-0 whitespace-nowrap text-neutral-400">
                interactive
              </p>
              <p className="tracking-tight text-neutral-100">
                Constellation Atlas — the sky, drawn by the gods&apos; hands
              </p>
            </div>
          </Link>
          <Link className="flex flex-col space-y-1 mb-4" href="/collision">
            <div className="w-full flex flex-col md:flex-row md:items-baseline space-x-0 md:space-x-2">
              <p className="font-readout w-[110px] shrink-0 whitespace-nowrap text-neutral-400">
                interactive
              </p>
              <p className="tracking-tight text-neutral-100">
                Collision — the Milky Way meets Andromeda, live N-body
              </p>
            </div>
          </Link>
          <Link className="flex flex-col space-y-1 mb-4" href="/blackhole">
            <div className="w-full flex flex-col md:flex-row md:items-baseline space-x-0 md:space-x-2">
              <p className="font-readout w-[110px] shrink-0 whitespace-nowrap text-neutral-400">
                interactive
              </p>
              <p className="tracking-tight text-neutral-100">
                Accretion — NASA&apos;s black hole, set in motion
              </p>
            </div>
          </Link>
          {[
            ['carina', 'Cosmic Cliffs — the Carina Nebula in particles'],
            ['southern-ring', 'Southern Ring — a dying star, shell by shell'],
            ['ring-nebula', 'Ring Nebula — a sunlike star’s last breath'],
            ['cats-eye', 'Cat’s Eye — eleven shells and an X-ray heart'],
            ['helix', 'Helix — the eye of god, a trillion miles wide'],
            ['butterfly', 'Butterfly — 20,000-degree wings'],
            ['crab', 'Crab Nebula — the wreckage of 1054, still glowing'],
            ['tarantula', 'Tarantula Nebula — the Local Group’s star factory'],
            ['deep-field', 'Deep Field — fall into SMACS 0723, galaxy by galaxy'],
          ].map(([slug, label]) => (
            <Link
              key={slug}
              className="flex flex-col space-y-1 mb-4"
              href={`/nebula/${slug}`}
            >
              <div className="w-full flex flex-col md:flex-row md:items-baseline space-x-0 md:space-x-2">
                <p className="font-readout w-[110px] shrink-0 whitespace-nowrap text-neutral-400">
                  interactive
                </p>
                <p className="tracking-tight text-neutral-100">{label}</p>
              </div>
            </Link>
          ))}
          {miscPosts.map((post) => (
            <Link
              key={post.slug}
              className="flex flex-col space-y-1 mb-4"
              href={`/blog/${post.slug}`}
            >
              <div className="w-full flex flex-col md:flex-row md:items-baseline space-x-0 md:space-x-2">
                <p className="font-readout w-[110px] shrink-0 whitespace-nowrap text-neutral-400">
                  {formatDate(post.metadata.publishedAt, false)}
                </p>
                <p className="tracking-tight text-neutral-100">
                  {post.metadata.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
        <p className="font-readout mt-10 text-neutral-400 [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_12px_rgba(0,0,0,0.8)]">
          background — pillars of creation, eagle nebula (M16). NASA / ESA /
          CSA / STScI, JWST NIRCam 2022, rebuilt as ~100k particles with depth
          extruded from luminance. drag to pan · scroll to zoom · move your
          cursor.
        </p>
      </div>
    </div>
  )
}
