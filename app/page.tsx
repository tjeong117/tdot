import Link from 'next/link'
import { BlogPosts } from 'app/components/posts'
import { ResearchPapers } from 'app/components/research'
import { BlackHole } from 'app/components/black-hole'

export default function Page() {
  return (
    <>
      {/* Full-viewport hero pinned to the document top, covering the navbar; it
          provides its own links since the nav underneath is unreadable on black. */}
      <div className="absolute top-0 left-0 z-20 h-[100svh] w-full overflow-hidden bg-black">
        <BlackHole />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-white">
          <h1 className="text-4xl font-semibold tracking-tighter md:text-5xl">
            Tom Jeong
          </h1>
          <p className="mt-3 text-neutral-300">
            co-founder &amp; CTO of Datafruit (YC S25)
          </p>
          <nav className="pointer-events-auto mt-6 flex flex-row space-x-6 text-neutral-200">
            <Link href="/blog" className="underline-offset-4 hover:underline">
              blog
            </Link>
            <Link
              href="/research"
              className="underline-offset-4 hover:underline"
            >
              research
            </Link>
            <a
              href="https://www.linkedin.com/in/tomwsjeong"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              linkedin
            </a>
          </nav>
        </div>
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce text-neutral-400">
          ↓
        </div>
      </div>

      {/* Pushed below the hero: ~10rem of nav/margins sits above this in the flow. */}
      <section className="mt-[calc(100svh-6rem)]">
        <p className="mb-4">
          {`Hi, I'm Tom, co-founder and CTO of `}
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
          {`) where we are building AI systems for enterprise software implementation teams.`}
        </p>
        <p className="mb-4">
          {`I'm a recent grad from Georgia Institute of Technology where I studied Computer Science and Mathematics.`}
        </p>
        <p className="mb-4">
          {`You can reach out to me via `}
          <a
            href="https://www.linkedin.com/in/tomwsjeong"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            LinkedIn
          </a>
          {` or `}
          <a
            href="https://cal.com/jeong-tom-cqkvqm/15min"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            book a call
          </a>
          {`.`}
        </p>
        <div className="my-8">
          <h2 className="font-semibold text-xl mb-4 tracking-tighter">
            Research
          </h2>
          <ResearchPapers />
        </div>
        <div className="my-8">
          <h2 className="font-semibold text-xl mb-4 tracking-tighter">Blog</h2>
          <BlogPosts />
        </div>
      </section>
    </>
  )
}
