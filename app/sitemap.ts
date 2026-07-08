import { getBlogPosts } from 'app/blog/utils'

export const baseUrl = 'https://portfolio-blog-starter.vercel.app'

export default async function sitemap() {
  let blogs = getBlogPosts().map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.metadata.publishedAt,
  }))

  let routes = ['', '/blog', '/research', '/sky', '/misc', '/blackhole', '/nebula/carina', '/nebula/southern-ring', '/nebula/ring-nebula', '/nebula/cats-eye', '/nebula/helix', '/nebula/butterfly', '/nebula/crab', '/nebula/tarantula', '/nebula/deep-field'].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
  }))

  return [...routes, ...blogs]
}
