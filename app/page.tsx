import { BlogPosts } from 'app/components/posts'

export default function Page() {
  return (
    <section>
      <h1 className="mb-8 text-2xl font-semibold tracking-tighter">
        Tom Jeong
      </h1>
      <p className="mb-4">
        {`Co-founder & CTO at `}
        <a
          href="https://datafruit.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Datafruit (YC S25)
        </a>
        {`, where I build agentic systems for enterprise software teams. My work spans offline reinforcement learning, multi-agent orchestration, and production ML infrastructure.`}
      </p>
      <p className="mb-4">
        {`Previously Head TA for CS 3511 Advanced Algorithms Honors at Georgia Tech, where I studied Computer Science (AI concentration) with a minor in Mathematics.`}
      </p>
      <p className="mb-4">
        {`I'm currently researching LayerSkip for Mixture-of-Experts models and building QuDDPM — a quantum denoising diffusion model for studying information scrambling in chaotic quantum systems.`}
      </p>
      <div className="my-8">
        <BlogPosts />
      </div>
    </section>
  )
}
