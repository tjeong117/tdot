'use client'

import dynamic from 'next/dynamic'

const PDFViewer = dynamic(() => import('./PDFViewer'), { ssr: false })

export default function PDFViewerWrapper({ url }: { url: string }) {
  return <PDFViewer url={url} />
}
