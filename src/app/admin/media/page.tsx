import { db } from '@/lib/db'
import { requireOwner } from '@/lib/guard'
import { isBlobConfigured } from '@/lib/env'
import { MediaLibrary } from '@/components/media-library'

/** FR-042: pustaka media. */
export default async function AdminMediaPage() {
  await requireOwner()

  const media = await db.media.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      url: true,
      alt: true,
      mimeType: true,
      size: true,
      width: true,
      height: true,
      _count: { select: { coverFor: true } },
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Media</h1>

      {!isBlobConfigured && (
        <p className="mt-4 rounded-md border px-4 py-3 text-sm" style={{ background: 'var(--bg-subtle)' }}>
          <strong>Penyimpanan belum dikonfigurasi.</strong> Isi <code>BLOB_READ_WRITE_TOKEN</code> untuk
          mengaktifkan unggah. Panduan ada di <code>docs/SETUP.md</code>.
        </p>
      )}

      <MediaLibrary
        items={media.map((m) => ({
          id: m.id,
          url: m.url,
          alt: m.alt,
          mimeType: m.mimeType,
          size: m.size,
          width: m.width,
          height: m.height,
          usedAsCover: m._count.coverFor,
        }))}
        uploadEnabled={isBlobConfigured}
      />
    </div>
  )
}
