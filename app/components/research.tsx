import Link from 'next/link'
import { papers, formatPaperDate } from 'app/research/page'

export function ResearchPapers() {
  return (
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
  )
}
