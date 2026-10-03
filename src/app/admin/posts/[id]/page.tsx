import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/guard'
import { PostEditor } from '@/components/editor/post-editor'
import { getTagsForAdmin } from '@/lib/queries'

/** FR-020…FR-034: editor artikel. */
export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner()
  const { id } = await params

  const [post, availableTags] = await Promise.all([
    db.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      status: true,
      previewToken: true,
      commentsClosed: true,
      readingTime: true,
      wordCount: true,
      tags: { select: { tag: { select: { name: true } } } },
      },
    }),
    // Dioper sebagai prop, bukan di-fetch dari klien: tidak menambah route API
    // dan tidak menambah JS apa pun ke rute publik.
    getTagsForAdmin(),
  ])
  if (!post) notFound()

  return (
    <div>
      <Link href="/admin/posts" className="text-sm hover:underline" style={{ color: 'var(--fg-muted)' }}>
        ← Daftar artikel
      </Link>
      <div className="mt-4">
        <PostEditor
          post={{
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? '',
            content: post.content,
            status: post.status,
            tagNames: post.tags.map((t) => t.tag.name),
            previewToken: post.previewToken,
            commentsClosed: post.commentsClosed,
            readingTime: post.readingTime,
            wordCount: post.wordCount,
          }}
          availableTags={availableTags.map((t) => ({ name: t.name, count: t.count }))}
        />
      </div>
    </div>
  )
}
