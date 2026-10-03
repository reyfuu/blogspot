import type { PublicComment } from '@/lib/queries'
import { formatDateTime } from '@/lib/format'
import { CommentForm } from './comment-form'

/**
 * FR-070…FR-076: blok komentar.
 *
 * Komponen ini adalah Server Component. Isi komentar dirender sebagai TEKS BIASA
 * (TS-06 §6.2) — bukan Markdown, tanpa auto-link — sehingga tidak ada permukaan
 * XSS dari input yang tidak tepercaya. React meng-escape otomatis.
 */
export function CommentSection({
  postId,
  comments,
  closed,
  guestAllowed,
}: {
  postId: string
  comments: PublicComment[]
  closed: boolean
  guestAllowed: boolean
}) {
  const total = comments.reduce((n, c) => n + 1 + c.replies.length, 0)

  return (
    <section id="komentar" className="mt-16 border-t pt-8">
      <h2 className="text-xl font-semibold tracking-tight">
        Komentar {total > 0 && <span style={{ color: 'var(--fg-muted)' }}>({total})</span>}
      </h2>

      {comments.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--fg-muted)' }}>
          Belum ada komentar. Jadilah yang pertama.
        </p>
      ) : (
        <ol className="mt-6 space-y-6">
          {comments.map((c) => (
            <li key={c.id}>
              <CommentBody comment={c} />
              {c.replies.length > 0 && (
                <ol className="mt-4 space-y-4 border-l pl-4 sm:pl-6">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentBody comment={r} />
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-10">
        {closed ? (
          <p className="rounded-md border px-4 py-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
            Komentar untuk tulisan ini sudah ditutup.
          </p>
        ) : (
          <CommentForm postId={postId} guestAllowed={guestAllowed} />
        )}
      </div>
    </section>
  )
}

function CommentBody({ comment }: { comment: Omit<PublicComment, 'replies'> }) {
  return (
    <article>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{comment.authorName}</span>
        {/* FR-075: komentar owner ditandai jelas, bukan hanya berbeda warna. */}
        {comment.isOwner && (
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium" style={{ color: 'var(--accent)' }}>
            Penulis
          </span>
        )}
        <time dateTime={comment.createdAt.toISOString()} style={{ color: 'var(--fg-muted)' }}>
          {formatDateTime(comment.createdAt)}
        </time>
      </div>
      {/* whitespace-pre-line: baris baru dipertahankan tanpa memproses markup. */}
      <p className="mt-2 whitespace-pre-line leading-relaxed">{comment.body}</p>
    </article>
  )
}
