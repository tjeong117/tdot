import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

type Metadata = {
  title: string
  publishedAt: string
  summary: string
  image?: string
  tag?: string
}

/* Frontmatter is optional. Drop blog/anything.md in with no header at all and
   it still publishes: the title comes from the first heading (or the filename),
   the date from git's first commit for the file, and the summary from the
   opening paragraph. */

function parseFrontmatter(fileContent: string) {
  const frontmatterRegex = /^---\s*([\s\S]*?)\s*---/
  const match = frontmatterRegex.exec(fileContent)
  const metadata: Partial<Metadata> = {}

  if (!match) return { metadata, content: fileContent.trim() }

  match[1]
    .trim()
    .split('\n')
    .forEach((line) => {
      const [key, ...valueArr] = line.split(': ')
      if (!valueArr.length) return
      const value = valueArr.join(': ').trim().replace(/^['"](.*)['"]$/, '$1')
      metadata[key.trim() as keyof Metadata] = value
    })

  return { metadata, content: fileContent.replace(frontmatterRegex, '').trim() }
}

// 'why-quantum-matters' -> 'Why quantum matters'
function titleFromSlug(slug: string) {
  const words = slug.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// the first markdown heading, if the post opens with one
function titleFromContent(content: string) {
  return /^#{1,3}\s+(.+)$/m.exec(content)?.[1].trim()
}

// first real paragraph, trimmed to something list-sized
function summaryFromContent(content: string) {
  const body = content.replace(/^#{1,6}\s+.+$/gm, '').trim()
  const para = body.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  const plain = para.replace(/[*_`>]/g, '')
  return plain.length > 200 ? `${plain.slice(0, 197).trimEnd()}…` : plain
}

// when the file first landed in git; falls back to the filesystem for a post
// that has not been committed yet
function authoredAt(filePath: string) {
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--follow', '--format=%aI', '-1', '--', filePath],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim()
    if (out) return out.slice(0, 10)
  } catch {
    // no git available (or the file is untracked) — fall through
  }
  return fs.statSync(filePath).mtime.toISOString().slice(0, 10)
}

function getPostFiles(dir: string) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((file) => ['.md', '.mdx'].includes(path.extname(file)))
}

function getMDXData(dir: string) {
  return getPostFiles(dir).map((file) => {
    const filePath = path.join(dir, file)
    const parsed = parseFrontmatter(fs.readFileSync(filePath, 'utf-8'))
    const { metadata } = parsed
    let content = parsed.content
    const slug = path.basename(file, path.extname(file))

    let title = metadata.title
    if (!title) {
      const heading = titleFromContent(content)
      title = heading ?? titleFromSlug(slug)
      // the page already renders the title, so don't print it twice
      if (heading) content = content.replace(/^#{1,3}\s+.+$/m, '').trim()
    }

    return {
      metadata: {
        ...metadata,
        title,
        publishedAt: metadata.publishedAt ?? authoredAt(filePath),
        summary: metadata.summary ?? summaryFromContent(content),
      } as Metadata,
      slug,
      content,
    }
  })
}

export const POSTS_DIR = path.join(process.cwd(), 'blog')

export function getBlogPosts() {
  return getMDXData(POSTS_DIR)
}

export function formatDate(date: string, includeRelative = false) {
  let currentDate = new Date()
  if (!date.includes('T')) {
    date = `${date}T00:00:00`
  }
  let targetDate = new Date(date)

  let yearsAgo = currentDate.getFullYear() - targetDate.getFullYear()
  let monthsAgo = currentDate.getMonth() - targetDate.getMonth()
  let daysAgo = currentDate.getDate() - targetDate.getDate()

  let formattedDate = ''

  if (yearsAgo > 0) {
    formattedDate = `${yearsAgo}y ago`
  } else if (monthsAgo > 0) {
    formattedDate = `${monthsAgo}mo ago`
  } else if (daysAgo > 0) {
    formattedDate = `${daysAgo}d ago`
  } else {
    formattedDate = 'Today'
  }

  let fullDate = targetDate.toLocaleString('en-us', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  if (!includeRelative) {
    return fullDate
  }

  return `${fullDate} (${formattedDate})`
}
