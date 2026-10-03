import Link from 'next/link'
import type { PostCard as PostCardData } from '@/lib/queries'
import { formatDate } from '@/lib/format'

export function PostCard({ post }: { post: PostCardData }) {
  return (
    <article className="border-b py-6 last:border-b-0">
      <h2 className="text-xl font-semibold tracking-tight">
        <Link href={`/post/${post.slug}`} className="hover:underline">
          {post.title}
        </Link>
      </h2>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
        {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>}
        <span aria-hidden="true">·</span>
        <span>{post.readingTime} menit baca</span>
      </div>

      {post.excerpt && <p className="mt-3 leading-relaxed">{post.excerpt}</p>}

      {post.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/tag/${t.slug}`}
                className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-[var(--bg-subtle)]"
              >
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
