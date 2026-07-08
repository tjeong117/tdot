import { getBlogPosts } from 'app/blog/utils'
import { ARTIFACTS } from 'app/nebula/[slug]/page'

export const baseUrl = 'https://portfolio-blog-starter.vercel.app'

export default async function sitemap() {
  let blogs = getBlogPosts().map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.metadata.publishedAt,
  }))

  let routes = [
    '',
    '/blog',
    '/research',
    '/sky',
    '/misc',
    '/blackhole',
    ...Object.keys(ARTIFACTS).map((slug) => `/nebula/${slug}`),
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
  }))

  return [...routes, ...blogs]
}
