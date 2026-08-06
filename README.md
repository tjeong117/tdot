# tomjeong.dev

Personal site. Plain HTML in the browser's default serif, one 650px column, and
a particle banner. Next.js App Router, no CSS framework, no component library.

```
blog/                 posts, one file per post
app/
  page.tsx            home page text and links
  research/page.tsx   the papers list
  components/         banner, footer, back link, MDX setup
  global.css          every style on the site, ~280 lines
public/               images, PDFs; served from the root path
scripts/publish.mjs   what `npm run publish` runs
```

## Writing a post

Make a file in `blog/`. **The filename becomes the URL**, so
`blog/why-quantum-matters.md` serves at `/blog/why-quantum-matters`. Lowercase
and hyphens. Both `.md` and `.mdx` work.

Frontmatter is optional. This is a complete, publishable post:

```markdown
# Why quantum matters

The first paragraph becomes the summary shown on the index pages.

## A section

Math like $e^{i\pi}+1=0$, tables, code fences, **bold**, all work.
```

With no frontmatter you get the **title** from the opening heading (which is
then removed from the body so the page does not print it twice), the **date**
from the file's first git commit, and the **summary** from the first paragraph.

To set any of it yourself, add a frontmatter block. It always wins:

```markdown
---
title: 'Why quantum matters'
publishedAt: '2026-08-06'
summary: 'One line for the index page.'
tag: 'thoughts'
---
```

| field | what it does |
|---|---|
| `title` | overrides the heading-derived title |
| `publishedAt` | `YYYY-MM-DD`. Sorts the lists, newest first |
| `summary` | the line under the title on index pages |
| `tag` | which section the post files under, see below |
| `image` | social preview image, optional |

### Sections

Posts split into two lists on the home page and `/blog`:

- **Writing** is the default. Anything untagged, or tagged `research`, lands here.
- **Thought pieces** is for personal writing. Use `tag: 'thoughts'`.

The spelling is forgiving, so `thought`, `thoughts`, `thought piece`,
`thought pieces`, `essay`, `essays`, and `personal` all file under Thought
pieces. Anything else goes to Writing. The Thought pieces heading only appears
once at least one post carries the tag, so an empty section never shows.

### What works in a post

Markdown, plus GitHub tables, LaTeX via KaTeX (`$inline$` and `$$display$$`),
fenced code with syntax highlighting, and raw HTML/JSX. Images go in `public/`
and are referenced from the root: `public/charts/plot.png` becomes
`![a plot](/charts/plot.png)`. PDFs work the same way.

## Publishing

```bash
npm run publish
```

That finds every added or modified post in `blog/`, writes a frontmatter block
into any post that lacks one (so the date is pinned in the file rather than
re-derived on every build), commits, and pushes to `main`. Vercel builds from
the push. Live in about a minute.

```
$ npm run publish
  + blog/why-quantum.md  "Why quantum"
      wrote frontmatter, summary: The first paragraph, trimmed...
  committed  a3f21e9  Post: Why quantum
  pushed     main
```

To see what it would do without touching anything:

```bash
npm run publish -- --dry-run
```

Editing an existing post uses the same command; it picks up modifications, not
just new files.

**Everything in `blog/` is live once published.** The script publishes every
changed post in that folder, so keep drafts somewhere else until they are ready.

## Previewing

```bash
npm run dev      # localhost:3000
npm run build    # what Vercel runs; catches almost every deploy failure
```

Worth a look at `npm run dev` after editing prose inside a `.tsx` file. A
mistake like putting an `<a>` tag inside a template literal is valid JavaScript,
so the build stays green while the page prints the raw tag to visitors.

## Editing the rest of the site

| what | where |
|---|---|
| home page bio and links | `app/page.tsx` |
| research papers list | the `papers` array in `app/research/page.tsx` |
| footer nav | `app/components/footer.tsx` |
| type, spacing, colours | `app/global.css` |
| banner image, height, density | `app/components/logo.tsx` and `particle-logo.tsx` |

`npm run publish` only stages `blog/`, so commit these yourself:

```bash
git add -A && git commit -m "Update bio" && git push
```

## Deploying and redeploying

Every push to `main` deploys. There is no separate deploy step.

To force a rebuild with no content change:

```bash
git commit --allow-empty -m "Trigger redeploy" && git push
```

To check a deploy from the terminal:

```bash
gh api repos/tjeong117/tdot/deployments --jq '.[0].id'
gh api repos/tjeong117/tdot/deployments/<id>/statuses --jq '.[0].state'
```

`success` means live. `failure` means the build broke and the previous version
is still serving, since Vercel will not replace a good deployment with a broken
one. Run `npm run build` locally to reproduce almost any failure. The exception
is dependency drift: if you add or remove a package, commit `pnpm-lock.yaml`
alongside `package.json`, because Vercel installs with `--frozen-lockfile`.

The repo is public on purpose. On the Hobby plan a private repo gates deploys on
the commit author having project access, and no author here maps to that Vercel
account, so private builds get blocked. Commits should carry no `Co-Authored-By`
trailer for the same reason.
