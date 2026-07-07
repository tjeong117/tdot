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
      <h1 className="ring-rule font-semibold text-2xl mb-8 tracking-tighter">
        Research
      </h1>
      <div>
        {papers.map((paper) => (
          <Link
            key={paper.slug}
            className="flex flex-col space-y-1 mb-4"
            href={`/research/${paper.slug}`}
          >
            <div className="w-full flex flex-col md:flex-row md:items-baseline space-x-0 md:space-x-2">
              <p className="font-readout text-neutral-600 dark:text-neutral-400 w-[150px] shrink-0 whitespace-nowrap tabular-nums">
                {formatPaperDate(paper.date)}
              </p>
              <p className="text-neutral-900 dark:text-neutral-100 tracking-tight">
                {paper.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
