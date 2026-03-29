'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type Props = {
  url: string
}

export default function PDFViewer({ url }: Props) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)

  return (
    <div className="flex flex-col items-center gap-4">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      >
        <Page pageNumber={pageNumber} width={700} />
      </Document>
      <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
        <button
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          disabled={pageNumber <= 1}
          className="disabled:opacity-30 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          ← prev
        </button>
        <span>
          {pageNumber} / {numPages}
        </span>
        <button
          onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
          disabled={pageNumber >= numPages}
          className="disabled:opacity-30 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          next →
        </button>
      </div>
    </div>
  )
}
