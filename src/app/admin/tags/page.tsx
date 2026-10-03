import { requireOwner } from '@/lib/guard'
import { getTagsForAdmin } from '@/lib/queries'
import { TagManager } from '@/components/tag-manager'

/** FR-084: halaman kelola tag. */
export default async function AdminTagsPage() {
  await requireOwner()
  const tags = await getTagsForAdmin()

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Tag</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
        {tags.length} tag. Gabungkan tag kembar agar artikel lebih mudah ditemukan.
      </p>
      <TagManager tags={tags} />
    </div>
  )
}
