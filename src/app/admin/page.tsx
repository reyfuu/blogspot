import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/guard'
import { formatDateTime } from '@/lib/format'
import { NewPostButton } from '@/components/new-post-button'

/** FR-080: dashboard ringkas. */
export default async function AdminDashboard() {
  await requireOwner()

  const [counts, pendingComments, recent] = await Promise.all([
    db.post.groupBy({ by: ['status'], _count: { _all: true } }),
    db.comment.count({ where: { status: 'PENDING' } }),
    db.post.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, updatedAt: true },
    }),
  ])

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))
  const stats = [
    { label: 'Terbit', value: byStatus['PUBLISHED'] ?? 0 },
    { label: 'Draf', value: byStatus['DRAFT'] ?? 0 },
    { label: 'Terjadwal', value: byStatus['SCHEDULED'] ?? 0 },
    { label: 'Terarsip', value: byStatus['ARCHIVED'] ?? 0 },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <NewPostButton />
      </div>

      {/* BRULE-32: antrian moderasi jadi sorotan utama, bukan angka di pojok. */}
      {pendingComments > 0 && (
        <Link
          href="/admin/comments"
          className="mt-6 flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-[var(--bg-subtle)]"
        >
          <span className="font-medium">
            {pendingComments} komentar menunggu moderasi
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Terakhir disunting</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
            Belum ada artikel.
          </p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <Link href={`/admin/posts/${p.id}`} className="font-medium hover:underline">
                  {p.title}
                </Link>
                <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                  {p.status} · {formatDateTime(p.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
