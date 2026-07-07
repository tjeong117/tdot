import Link from 'next/link'
import { formatDate, getBlogPosts } from 'app/blog/utils'

export function BlogPosts() {
  let allBlogs = getBlogPosts()

  return (
    <div>
      {allBlogs
        .sort((a, b) => {
          if (
            new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)
          ) {
            return -1
          }
          return 1
        })
        .map((post) => (
          <Link
            key={post.slug}
            className="flex flex-col space-y-1 mb-4"
            href={`/blog/${post.slug}`}
          >
            <div className="w-full flex flex-col md:flex-row md:items-baseline space-x-0 md:space-x-2">
              <p className="font-readout text-neutral-600 dark:text-neutral-400 w-[150px] shrink-0 whitespace-nowrap tabular-nums">
                {formatDate(post.metadata.publishedAt, false)}
              </p>
              <p className="text-neutral-900 dark:text-neutral-100 tracking-tight">
                {post.metadata.title}
                {post.metadata.tag === 'research' && (
                  <span className="eh-pill ml-2 inline-flex items-center align-middle rounded-full px-2 py-0.5 text-xs font-medium">
                    research
                  </span>
                )}
              </p>
            </div>
          </Link>
        ))}
    </div>
  )
}
