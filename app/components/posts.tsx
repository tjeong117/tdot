import Link from 'next/link'
import { formatDate, getBlogPosts, groupPosts } from 'app/blog/utils'

type Post = ReturnType<typeof getBlogPosts>[number]

function List({ posts }: { posts: Post[] }) {
  return (
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
  )
}

export function BlogPosts() {
  const allBlogs = getBlogPosts().sort(
    (a, b) =>
      new Date(b.metadata.publishedAt).getTime() -
      new Date(a.metadata.publishedAt).getTime()
  )
  const { writing, thoughts } = groupPosts(allBlogs)

  return (
    <>
      <List posts={writing} />
      {thoughts.length > 0 && (
        <>
          <h3>
            <strong>Thought pieces</strong>
          </h3>
          <List posts={thoughts} />
        </>
      )}
    </>
  )
}
