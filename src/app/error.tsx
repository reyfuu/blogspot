'use client'

/** E-SYS-01: pesan generik — tidak pernah menampilkan jejak teknis ke pengguna. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Terjadi kesalahan</h1>
      <p className="mt-3" style={{ color: 'var(--fg-muted)' }}>
        Silakan coba lagi. Jika masalah berlanjut, muat ulang halaman.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md border px-4 py-2 text-sm font-medium hover:bg-[var(--bg-subtle)]"
      >
        Coba lagi
      </button>
    </div>
  )
}
