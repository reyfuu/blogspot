import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signIn } from '@/lib/auth'
import { getSessionUser } from '@/lib/guard'
import { isGitHubAuthConfigured } from '@/lib/env'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = {
  title: 'Masuk',
  robots: { index: false, follow: false },
}

/** FR-001: halaman masuk. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
  const user = await getSessionUser()

  // Sudah masuk: langsung ke tujuan semula (FR-001).
  if (user) redirect(user.role === 'OWNER' ? (next ?? '/admin') : '/')

  const settings = await getSettings()

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Masuk ke {settings.siteName}</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
        Gunakan akun GitHub Anda. Tidak ada kata sandi yang disimpan.
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded-md border px-4 py-3 text-sm" style={{ color: 'oklch(0.55 0.19 25)' }}>
          Proses masuk tidak dapat diselesaikan. Silakan coba lagi.
        </p>
      )}

      {isGitHubAuthConfigured ? (
        <form
          className="mt-8"
          action={async () => {
            'use server'
            await signIn('github', { redirectTo: next ?? '/admin' })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-[var(--bg-subtle)]"
          >
            Masuk dengan GitHub
          </button>
        </form>
      ) : (
        // Jujur soal konfigurasi yang belum lengkap, bukan tombol yang diam-diam gagal.
        <div className="mt-8 rounded-md border px-4 py-4 text-sm" style={{ background: 'var(--bg-subtle)' }}>
          <p className="font-medium">Autentikasi belum dikonfigurasi</p>
          <p className="mt-2" style={{ color: 'var(--fg-muted)' }}>
            Isi <code>AUTH_GITHUB_ID</code> dan <code>AUTH_GITHUB_SECRET</code> pada environment. Panduan ada di{' '}
            <code>docs/SETUP.md</code>.
          </p>
        </div>
      )}

      <Link href="/" className="mt-8 text-sm hover:underline" style={{ color: 'var(--fg-muted)' }}>
        ← Kembali ke beranda
      </Link>
    </div>
  )
}
