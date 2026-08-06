import Link from 'next/link'

export const metadata = {
  title: 'Research',
}

const papers = [
  {
    slug: 'layerskip-moe',
    title: 'LayerSkip for Mixture of Experts',
    date: '2025-01',
    pdf: '/research/moePaper.pdf',
  },
]

export { papers }

// '2025-01' -> 'January 2025', matching the long-month style of blog dates
export function formatPaperDate(date: string) {
  const [year, month] = date.split('-').map(Number)
  return new Date(year, month - 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export default function ResearchPage() {
  return (
    <section>
      <h2>
        <strong>Research</strong>
      </h2>
      <ul className="entries">
        {papers.map((paper) => (
          <li key={paper.slug}>
            <Link href={`/research/${paper.slug}`}>{paper.title}</Link>
            <span className="date">{formatPaperDate(paper.date)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
