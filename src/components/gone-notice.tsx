import Link from 'next/link'

/**
 * BRULE-13: artikel terarsip merespons 410 Gone — sinyal eksplisit ke mesin
 * pencari bahwa konten sengaja dihapus, bukan 404 yang ambigu.
 */
export function GoneNotice() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Tulisan ini sudah diarsipkan</h1>
      <p className="mt-3" style={{ color: 'var(--fg-muted)' }}>
        Tulisan ini tidak lagi tersedia untuk publik.
      </p>
      <Link href="/archive" className="mt-6 inline-block text-sm font-medium hover:underline" style={{ color: 'var(--accent)' }}>
        Lihat arsip tulisan lain →
      </Link>
    </div>
  )
}
