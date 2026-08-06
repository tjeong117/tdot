import { notFound } from 'next/navigation'
import { Back } from 'app/components/back'
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
      <Back />
      <h2>
        <strong>{paper.title}</strong>
      </h2>
      <PDFViewerWrapper url={paper.pdf} />
    </section>
  )
}
