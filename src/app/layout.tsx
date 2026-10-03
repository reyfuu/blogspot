import type { Metadata, Viewport } from 'next'
import { ThemeScript } from '@/components/theme-script'
import { SITE_URL } from '@/lib/env'
import { getSettings } from '@/lib/settings'
import './globals.css'

/** BRULE-27: metadataBase membuat SELURUH URL metadata menjadi absolut. */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${s.siteName} — ${s.tagline}`, template: `%s — ${s.siteName}` },
    description: s.description,
    alternates: {
      canonical: '/',
      types: { 'application/rss+xml': [{ url: '/rss.xml', title: `${s.siteName} RSS` }] },
    },
    openGraph: { type: 'website', siteName: s.siteName, locale: 'id_ID', url: '/' },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121418' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // A-6: konten Bahasa Indonesia.
    <html lang="id" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        {/* FR-057: tautan lewati-ke-konten harus menjadi elemen fokus pertama. */}
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
          style={{ background: 'var(--bg-subtle)', color: 'var(--fg)' }}
        >
          Lewati ke konten
        </a>
        {children}
      </body>
    </html>
  )
}
