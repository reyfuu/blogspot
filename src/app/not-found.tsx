import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
      <p className="mt-3" style={{ color: 'var(--fg-muted)' }}>
        Alamat yang Anda tuju tidak ada atau sudah dipindahkan.
      </p>
      <div className="mt-6 flex gap-4 text-sm font-medium">
        <Link href="/" className="hover:underline" style={{ color: 'var(--accent)' }}>
          Beranda
        </Link>
        <Link href="/archive" className="hover:underline" style={{ color: 'var(--accent)' }}>
          Arsip
        </Link>
      </div>
    </div>
  )
}
