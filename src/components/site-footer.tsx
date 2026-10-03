import Link from 'next/link'
import { getSettings } from '@/lib/settings'

export async function SiteFooter() {
  const s = await getSettings()
  const year = new Date().getFullYear()
  return (
    <footer className="mt-16 border-t" style={{ color: 'var(--fg-muted)' }}>
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {s.authorName}
        </p>
        <div className="flex gap-4">
          <Link href="/rss.xml" className="hover:underline">
            RSS
          </Link>
          <Link href="/archive" className="hover:underline">
            Arsip
          </Link>
        </div>
      </div>
    </footer>
  )
}
