import 'katex/dist/katex.min.css'
import './global.css'
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Logo } from './components/logo'
import Footer from './components/footer'
import { baseUrl } from './sitemap'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Tom Jeong',
    template: '%s | Tom Jeong',
  },
  description: 'Founding MTS at Refresh. Prev co-founder and CTO of Datafruit (YC S25).',
  openGraph: {
    title: 'Tom Jeong',
    description: 'Founding MTS at Refresh. Prev co-founder and CTO of Datafruit (YC S25).',
    url: baseUrl,
    siteName: 'Tom Jeong',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Logo />
        <main>{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
