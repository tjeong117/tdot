#!/usr/bin/env node
/* Publish whatever is sitting in blog/.
 *
 * Drop blog/anything.md in and run `npm run publish`. Any post missing a
 * frontmatter block gets one written into the file first — title from the
 * opening heading or the filename, date of today, summary from the first
 * paragraph — so the published date is pinned in the file rather than
 * re-derived on every build. Then it commits and pushes; Vercel deploys. */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BLOG = path.join(ROOT, 'blog')
const dryRun = process.argv.includes('--dry-run')

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf-8', cwd: ROOT }).trim()

const bail = (msg) => {
  console.error(msg)
  process.exit(1)
}

if (!existsSync(BLOG)) bail(`No blog/ directory at ${BLOG}`)

// posts that git sees as added, modified, or untracked
const changed = git('status', '--porcelain', '--', 'blog')
  .split('\n')
  .filter(Boolean)
  // a rename inside blog/ reports as "R  old -> new"; publish the new path
  .map((line) => line.slice(3).split(' -> ').pop().trim().replace(/^"|"$/g, ''))
  .filter((f) => /\.mdx?$/.test(f))

if (!changed.length) {
  console.log('Nothing to publish — blog/ matches the last commit.')
  process.exit(0)
}

const titleFromSlug = (slug) => {
  const words = slug.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const addFrontmatter = (file) => {
  const full = path.join(ROOT, file)
  const raw = readFileSync(full, 'utf-8')
  const slug = path.basename(file, path.extname(file))

  if (/^---\s*[\s\S]*?\s*---/.test(raw)) {
    const title = /^title:\s*['"]?(.+?)['"]?\s*$/m.exec(raw)?.[1]
    return { file, title: title ?? slug, wrote: false }
  }

  const heading = /^#{1,3}\s+(.+)$/m.exec(raw)?.[1]?.trim()
  const title = heading ?? titleFromSlug(slug)
  const body = heading ? raw.replace(/^#{1,3}\s+.+$/m, '').trim() : raw.trim()

  const firstPara =
    body
      .replace(/^#{1,6}\s+.+$/gm, '')
      .trim()
      .split(/\n\s*\n/)[0]
      ?.replace(/\s+/g, ' ')
      .replace(/[*_`>]/g, '')
      .trim() ?? ''
  const summary =
    firstPara.length > 200 ? `${firstPara.slice(0, 197).trimEnd()}…` : firstPara

  const quote = (s) => `'${s.replace(/'/g, "''")}'`
  const frontmatter = [
    '---',
    `title: ${quote(title)}`,
    `publishedAt: '${new Date().toISOString().slice(0, 10)}'`,
    `summary: ${quote(summary)}`,
    '---',
    '',
    body,
    '',
  ].join('\n')

  if (!dryRun) writeFileSync(full, frontmatter)
  return { file, title, wrote: true, summary }
}

const posts = changed.map(addFrontmatter)

for (const p of posts) {
  console.log(`  ${p.wrote ? '+' : '~'} ${p.file}  "${p.title}"`)
  if (p.wrote) {
    console.log(
      `      ${dryRun ? 'would write' : 'wrote'} frontmatter — summary: ${
        p.summary || '(empty)'
      }`
    )
  }
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const subject =
  posts.length === 1
    ? `Post: ${posts[0].title}`
    : `Post: ${posts.length} entries`

if (dryRun) {
  console.log(`  would commit "${subject}" and push to ${branch}`)
  process.exit(0)
}

git('add', '--', 'blog')
git('commit', '-m', subject)
const sha = git('rev-parse', '--short', 'HEAD')
console.log(`  committed  ${sha}  ${subject}`)

git('push', 'origin', branch)
console.log(`  pushed     ${branch}`)
console.log('  → vercel is building; the post is live once it finishes')
