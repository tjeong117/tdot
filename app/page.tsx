import Link from 'next/link'
import { formatDate, getBlogPosts } from 'app/blog/utils'
import { papers, formatPaperDate } from 'app/research/page'

export default function Page() {
  const posts = getBlogPosts().sort(
    (a, b) =>
      new Date(b.metadata.publishedAt).getTime() -
      new Date(a.metadata.publishedAt).getTime()
  )

  return (
    <>
      <h2>
        <strong>Tom Jeong</strong>
      </h2>
      <p>
        {`I'm a founding member of technical staff at Refresh. Previously I was co-founder and CTO of `}
        <a href="https://datafruit.ai" target="_blank" rel="noopener noreferrer">
          Datafruit
        </a>
        {` (`}
        <a
          href="https://www.ycombinator.com/companies/datafruit"
          target="_blank"
          rel="noopener noreferrer"
        >
          YC S25
        </a>
        {`), and before that I studied CS and Mathematics at Georgia Tech.`}
      </p>

      <h3>
        <strong>Writing</strong>
      </h3>
      <ul className="entries">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>{post.metadata.title}</Link>
            <span className="date">
              {formatDate(post.metadata.publishedAt, false)}
            </span>
          </li>
        ))}
      </ul>

      <h3>
        <strong>Research</strong>
      </h3>
      <ul className="entries">
        {papers.map((paper) => (
          <li key={paper.slug}>
            <Link href={`/research/${paper.slug}`}>{paper.title}</Link>
            <span className="date">{formatPaperDate(paper.date)}</span>
          </li>
        ))}
      </ul>

      <hr />

      <p>
        {`You can find me on `}
        <a
          href="https://github.com/tjeong117"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        {` and `}
        <a
          href="https://www.linkedin.com/in/tomwsjeong"
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        {`, or `}
        <a
          href="https://cal.com/jeong-tom-cqkvqm/15min"
          target="_blank"
          rel="noopener noreferrer"
        >
          book a call
        </a>
        {`.`}
      </p>
    </>
  )
}
