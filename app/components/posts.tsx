import Link from 'next/link'
import { formatDate, getBlogPosts } from 'app/blog/utils'

export function BlogPosts() {
  const allBlogs = getBlogPosts().sort(
    (a, b) =>
      new Date(b.metadata.publishedAt).getTime() -
      new Date(a.metadata.publishedAt).getTime()
  )

  return (
    <ul className="entries">
      {allBlogs.map((post) => (
        <li key={post.slug}>
          <Link href={`/blog/${post.slug}`}>{post.metadata.title}</Link>
          <span className="date">
            {formatDate(post.metadata.publishedAt, false)}
          </span>
        </li>
      ))}
    </ul>
  )
}
