import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/guard'
import { db } from '@/lib/db'
import { signOut } from '@/lib/auth'
import { ThemeToggle } from '@/components/theme-toggle'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

/**
 * Otorisasi lapis 2 — TRD TS-05 §5.2.
 *
 * Gerbang ini memastikan data administratif tidak pernah DIAMBIL untuk
 * non-owner, bukan hanya disembunyikan dari tampilan.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=/admin')

  // FR-002: READER mendapat 403 dan tidak diberi petunjuk apa pun soal isi di dalam.
  if (user.role !== 'OWNER') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-xl font-bold">Anda tidak memiliki akses ke halaman ini.</h1>
        <Link href="/" className="mt-6 text-sm hover:underline" style={{ color: 'var(--accent)' }}>
          ← Kembali ke beranda
        </Link>
      </div>
    )
  }

  const pendingCount = await db.comment.count({ where: { status: 'PENDING' } })

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b" style={{ background: 'var(--bg-subtle)' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3">
          <Link href="/admin" className="mr-3 font-semibold tracking-tight">
            Admin
          </Link>
          <nav aria-label="Navigasi admin" className="flex flex-wrap items-center gap-1 text-sm">
            <AdminLink href="/admin/posts">Artikel</AdminLink>
            <AdminLink href="/admin/tags">Tag</AdminLink>
            <AdminLink href="/admin/media">Media</AdminLink>
            <AdminLink href="/admin/comments">
              Komentar
              {/* BRULE-32: antrian moderasi tidak boleh terlupakan. */}
              {pendingCount > 0 && (
                <span
                  className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {pendingCount}
                </span>
              )}
            </AdminLink>
            <AdminLink href="/admin/settings">Pengaturan</AdminLink>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="rounded-md px-3 py-2 text-sm hover:bg-[var(--bg)]">
              Lihat situs
            </Link>
            <ThemeToggle />
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/' })
              }}
            >
              <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--bg)]">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="konten" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  )
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center rounded-md px-3 py-2 hover:bg-[var(--bg)]">
      {children}
    </Link>
  )
}
