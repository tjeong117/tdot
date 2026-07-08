import Link from 'next/link'
import { HomeShell, type Scene } from 'app/components/home-shell'
import { ARTIFACTS } from 'app/nebula/[slug]/page'
import { formatDate, getBlogPosts } from 'app/blog/utils'
import { papers, formatPaperDate } from 'app/research/page'

const cardShell =
  'home-card w-full max-w-md rounded-2xl border border-white/10 bg-black/50 p-6 backdrop-blur-sm'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-h-full snap-start items-center justify-center px-6 py-10 md:px-12">
      <div data-card className={cardShell}>
        {children}
      </div>
    </section>
  )
}

const BUTTERFLY_CAPTION = 'butterfly nebula · NGC 6302 — hubble, 2009'

export default function Page() {
  const posts = getBlogPosts().sort(
    (a, b) =>
      new Date(b.metadata.publishedAt).getTime() -
      new Date(a.metadata.publishedAt).getTime()
  )

  const artifacts = Object.entries(ARTIFACTS)
  // one scene per card, in card order: the left panel morphs to match
  const scenes: Scene[] = [
    { key: 'butterfly', src: '/misc/butterfly.jpg', caption: BUTTERFLY_CAPTION },
    ...artifacts.map(([slug, a]) => ({
      key: slug,
      src: typeof a.options.src === 'string' ? a.options.src : a.options.src.landscape,
      caption: `${a.title.toLowerCase()} · ${
        a.credit.split('—')[1]?.trim().toLowerCase() ?? 'nasa'
      }`,
    })),
    {
      key: 'accretion',
      src: '/misc/blackhole-src.jpg',
      caption: 'accretion · nasa gsfc visualization, 2019',
    },
    { key: 'sky', src: null, caption: 'the night sky · 2,061 stars, hyg catalog' },
    { key: 'butterfly', src: '/misc/butterfly.jpg', caption: BUTTERFLY_CAPTION },
  ]

  return (
    <HomeShell scenes={scenes}>
      <Card>
        <p className="font-readout mb-4 text-neutral-500">hello</p>
        <p className="mb-4 text-neutral-200">
          {`Hi, I'm Tom — a founding member of technical staff at Refresh. Previously I was co-founder and CTO of `}
          <a
            href="https://datafruit.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Datafruit
          </a>
          {` (`}
          <a
            href="https://www.ycombinator.com/companies/datafruit"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            YC S25
          </a>
          {`), and before that I studied CS and Mathematics at Georgia Tech.`}
        </p>
        <p className="mb-6 text-neutral-300">
          {`This site doubles as a small planetarium — every image here is a real NASA/ESA observation rebuilt as an interactive particle volume. Scroll, and the nebula on the left rearranges itself into the next one.`}
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-neutral-200">
          <Link href="/blog" className="eh-hover-bright">
            blog
          </Link>
          <Link href="/research" className="eh-hover-bright">
            research
          </Link>
          <Link href="/misc" className="eh-hover-bright">
            misc
          </Link>
          <Link href="/sky" className="eh-hover-bright">
            sky
          </Link>
          <a
            href="https://www.linkedin.com/in/tomwsjeong"
            target="_blank"
            rel="noopener noreferrer"
            className="eh-hover-bright"
          >
            linkedin
          </a>
          <a
            href="https://cal.com/jeong-tom-cqkvqm/15min"
            target="_blank"
            rel="noopener noreferrer"
            className="eh-hover-bright"
          >
            book a call
          </a>
        </nav>
        <p className="font-readout mt-6 text-neutral-500">scroll ↓</p>
      </Card>

      {artifacts.map(([slug, artifact]) => (
        <Card key={slug}>
          <Link href={`/nebula/${slug}`} className="group block">
            <h2 className="ring-rule mb-3 text-xl font-semibold tracking-tighter">
              {artifact.title}
            </h2>
            <p className="mb-3 text-sm text-neutral-300">{artifact.blurb}</p>
            <p className="font-readout text-neutral-400 group-hover:text-neutral-200 transition-colors">
              explore in particles →
            </p>
          </Link>
        </Card>
      ))}

      <Card>
        <Link href="/blackhole" className="group block">
          <h2 className="ring-rule mb-3 text-xl font-semibold tracking-tighter">
            Accretion
          </h2>
          <p className="mb-3 text-sm text-neutral-300">
            {`A true 3D black hole seeded from NASA's visualization — Keplerian orbits, live Doppler beaming, and a lensed halo that follows your eye.`}
          </p>
          <p className="font-readout text-neutral-400 group-hover:text-neutral-200 transition-colors">
            drag to orbit →
          </p>
        </Link>
      </Card>

      <Card>
        <Link href="/sky" className="group block">
          <h2 className="ring-rule mb-3 text-xl font-semibold tracking-tighter">
            Constellation Atlas
          </h2>
          <p className="mb-3 text-sm text-neutral-300">
            {`Two thousand real stars at their true positions, colored by temperature, with all 88 classical figures — the gods' hands — traced in gold.`}
          </p>
          <p className="font-readout text-neutral-400 group-hover:text-neutral-200 transition-colors">
            drag to pan the sky →
          </p>
        </Link>
      </Card>

      <Card>
        <h2 className="ring-rule mb-4 text-xl font-semibold tracking-tighter">
          Research
        </h2>
        {papers.map((paper) => (
          <Link
            key={paper.slug}
            href={`/research/${paper.slug}`}
            className="mb-3 block"
          >
            <p className="font-readout text-neutral-400">
              {formatPaperDate(paper.date)}
            </p>
            <p className="text-neutral-100">{paper.title}</p>
          </Link>
        ))}
        <h2 className="ring-rule mb-4 mt-8 text-xl font-semibold tracking-tighter">
          Blog
        </h2>
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="mb-3 block"
          >
            <p className="font-readout text-neutral-400">
              {formatDate(post.metadata.publishedAt, false)}
            </p>
            <p className="text-neutral-100">{post.metadata.title}</p>
          </Link>
        ))}
        <div className="mt-8 flex gap-5 text-neutral-400">
          <a
            href="https://github.com/tjeong117"
            target="_blank"
            rel="noopener noreferrer"
            className="eh-hover-bright"
          >
            github
          </a>
          <a
            href="https://linkedin.com/in/tomwsjeong"
            target="_blank"
            rel="noopener noreferrer"
            className="eh-hover-bright"
          >
            linkedin
          </a>
        </div>
        <p className="font-readout mt-4 text-neutral-500">
          © {new Date().getFullYear()} tom jeong
        </p>
      </Card>
    </HomeShell>
  )
}
