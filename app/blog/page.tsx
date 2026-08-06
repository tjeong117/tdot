import { BlogPosts } from 'app/components/posts'

export const metadata = {
  title: 'Blog',
  description: 'Read my blog.',
}

export default function Page() {
  return (
    <section>
      <h2>
        <strong>Writing</strong>
      </h2>
      <BlogPosts />
    </section>
  )
}
