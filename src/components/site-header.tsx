import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'
import { getSettings } from '@/lib/settings'

export async function SiteHeader() {
  const s = await getSettings()
  return (
    <header className="border-b" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-semibold tracking-tight hover:opacity-80">
          {s.siteName}
        </Link>
        <nav aria-label="Navigasi utama" className="flex items-center gap-1 text-sm">
          <Link href="/archive" className="rounded-md px-3 py-2 hover:bg-[var(--bg-subtle)]">
            Arsip
          </Link>
          <Link href="/tag" className="rounded-md px-3 py-2 hover:bg-[var(--bg-subtle)]">
            Topik
          </Link>
          <Link href="/search" className="rounded-md px-3 py-2 hover:bg-[var(--bg-subtle)]">
            Cari
          </Link>
          <Link href="/about" className="rounded-md px-3 py-2 hover:bg-[var(--bg-subtle)]">
            Tentang
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
