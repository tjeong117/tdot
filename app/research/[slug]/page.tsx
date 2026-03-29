import { notFound } from 'next/navigation'
import { papers } from '../page'
import PDFViewerWrapper from '../PDFViewerWrapper'

export function generateStaticParams() {
  return papers.map((p) => ({ slug: p.slug }))
}

export default async function PaperPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const paper = papers.find((p) => p.slug === slug)

  if (!paper) notFound()

  return (
    <section>
      <h1 className="font-semibold text-2xl mb-8 tracking-tighter">{paper.title}</h1>
      <PDFViewerWrapper url={paper.pdf} />
    </section>
  )
}
