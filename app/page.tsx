import { BlogPosts } from 'app/components/posts'
import { ResearchPapers } from 'app/components/research'

export default function Page() {
  return (
    <section>
      <h1 className="mb-8 text-2xl font-semibold tracking-tighter">
        Tom Jeong
      </h1>
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
        {`Currently building QuDDPM — a quantum denoising diffusion model for information scrambling.`}
      </p>
      <p className="mb-4">
        {`You can reach out to me via `}
        <a
          href="https://www.linkedin.com/in/tomjeong"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          LinkedIn
        </a>
        {`.`}
      </p>
      <div className="my-8">
        <h2 className="font-semibold text-xl mb-4 tracking-tighter">Research</h2>
        <ResearchPapers />
      </div>
      <div className="my-8">
        <h2 className="font-semibold text-xl mb-4 tracking-tighter">Blog</h2>
        <BlogPosts />
      </div>
    </section>
  )
}
