import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/guard'
import { formatDateTime } from '@/lib/format'
import { ModerationQueue } from '@/components/moderation-queue'
import type { CommentStatus } from '@/generated/prisma/enums'

const FILTERS: (CommentStatus | 'ALL')[] = ['PENDING', 'APPROVED', 'REJECTED', 'SPAM', 'ALL']

/** FR-073: antrian moderasi. PENDING ditampilkan lebih dulu. */
export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireOwner()
  const { status } = await searchParams
  const active = (FILTERS.includes(status as CommentStatus) ? status : 'PENDING') as CommentStatus | 'ALL'

  const comments = await db.comment.findMany({
    where: active === 'ALL' ? {} : { status: active },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      body: true,
      status: true,
      createdAt: true,
      guestName: true,
      // Email tamu HANYA terlihat di antarmuka moderasi owner (BRULE-30).
      guestEmail: true,
      author: { select: { name: true, email: true, role: true } },
      post: { select: { title: true, slug: true } },
    },
  })

  const counts = await db.comment.groupBy({ by: ['status'], _count: { _all: true } })
  const countFor = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Moderasi komentar</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/comments?status=${f}`}
            className="rounded-full border px-3 py-1 text-sm hover:bg-[var(--bg-subtle)]"
            style={active === f ? { background: 'var(--bg-subtle)', fontWeight: 600 } : undefined}
            aria-current={active === f ? 'true' : undefined}
          >
            {f === 'ALL' ? 'Semua' : f}
            {f !== 'ALL' && ` (${countFor(f)})`}
          </Link>
        ))}
      </div>

      {comments.length === 0 ? (
        <p className="py-16 text-center" style={{ color: 'var(--fg-muted)' }}>
          {active === 'PENDING' ? 'Antrian bersih. Tidak ada komentar menunggu.' : 'Tidak ada komentar.'}
        </p>
      ) : (
        <ModerationQueue
          comments={comments.map((c) => ({
            id: c.id,
            body: c.body,
            status: c.status,
            createdAt: formatDateTime(c.createdAt),
            authorName: c.author?.name ?? c.guestName ?? 'Anonim',
            authorEmail: c.author?.email ?? c.guestEmail ?? null,
            isOwner: c.author?.role === 'OWNER',
            postTitle: c.post.title,
            postSlug: c.post.slug,
          }))}
        />
      )}
    </div>
  )
}
