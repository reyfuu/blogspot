'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteTag, mergeTags, renameTag } from '@/actions/tags'

export type TagRow = { id: string; slug: string; name: string; count: number }

/**
 * FR-084: kelola tag — rename, gabung, hapus.
 *
 * BRULE-36: slug tidak pernah berubah, jadi rename aman terhadap SEO.
 * Perbaikan slug yang salah dilakukan lewat gabung ke tag baru, yang otomatis
 * meninggalkan alias 301.
 */
export function TagManager({ tags }: { tags: TagRow[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [merging, setMerging] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, done: string) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await fn()
      if (result.ok) {
        setNotice(done)
        setEditing(null)
        setMerging(null)
        setMergeTarget('')
        router.refresh()
      } else {
        setError(result.message ?? 'Terjadi kesalahan.')
      }
    })
  }

  if (tags.length === 0) {
    return (
      <p className="py-16 text-center" style={{ color: 'var(--fg-muted)' }}>
        Belum ada tag. Tag dibuat otomatis saat Anda menambahkannya di editor artikel.
      </p>
    )
  }

  return (
    <div className="mt-6">
      {notice && (
        <p role="status" className="mb-4 rounded-md border px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)' }}>
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm" style={{ color: 'oklch(0.55 0.19 25)' }}>
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Daftar tag beserta jumlah artikel dan aksi pengelolaan</caption>
          <thead>
            <tr className="border-b text-left" style={{ color: 'var(--fg-muted)' }}>
              <th scope="col" className="py-2 pr-4 font-medium">Nama</th>
              <th scope="col" className="py-2 pr-4 font-medium">Slug (URL)</th>
              <th scope="col" className="py-2 pr-4 font-medium">Artikel</th>
              <th scope="col" className="py-2 font-medium"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tags.map((t) => (
              <tr key={t.id}>
                <td className="py-3 pr-4">
                  {editing === t.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') run(() => renameTag({ id: t.id, name: draftName }), 'Nama tag diperbarui.')
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      aria-label={`Nama baru untuk tag ${t.name}`}
                      className="w-full rounded border px-2 py-1"
                      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
                    />
                  ) : (
                    <span className="font-medium">{t.name}</span>
                  )}
                </td>

                <td className="py-3 pr-4">
                  <code className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                    /tag/{t.slug}
                  </code>
                </td>

                <td className="py-3 pr-4 tabular-nums">
                  {t.count > 0 ? (
                    <Link href={`/admin/posts?tag=${t.slug}`} className="underline">
                      {t.count}
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--fg-muted)' }}>0</span>
                  )}
                </td>

                <td className="py-3">
                  {merging === t.id ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <label htmlFor={`merge-${t.id}`} className="text-xs">
                        Gabung ke
                      </label>
                      <select
                        id={`merge-${t.id}`}
                        value={mergeTarget}
                        onChange={(e) => setMergeTarget(e.target.value)}
                        className="rounded border px-2 py-1 text-xs"
                        style={{ background: 'var(--bg)', color: 'var(--fg)' }}
                      >
                        <option value="">— pilih tag —</option>
                        {tags
                          .filter((o) => o.id !== t.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={pending || !mergeTarget}
                        onClick={() => {
                          const target = tags.find((o) => o.id === mergeTarget)
                          if (!target) return
                          if (
                            !window.confirm(
                              `Gabungkan "${t.name}" ke "${target.name}"?\n\n` +
                                `• ${t.count} artikel dipindahkan\n` +
                                `• /tag/${t.slug} akan dialihkan permanen ke /tag/${target.slug}\n` +
                                `• Tindakan ini tidak dapat dibatalkan.`,
                            )
                          )
                            return
                          run(() => mergeTags({ fromId: t.id, intoId: mergeTarget }), `"${t.name}" digabung ke "${target.name}".`)
                        }}
                        className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                      >
                        Gabung
                      </button>
                      <button type="button" onClick={() => setMerging(null)} className="px-1 text-xs">
                        Batal
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-1">
                      {editing === t.id ? (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => renameTag({ id: t.id, name: draftName }), 'Nama tag diperbarui.')}
                            className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                          >
                            Simpan
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className="px-2 py-1 text-xs">
                            Batal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(t.id)
                              setDraftName(t.name)
                            }}
                            className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-subtle)]"
                          >
                            Ganti nama
                          </button>
                          <button
                            type="button"
                            onClick={() => setMerging(t.id)}
                            className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-subtle)]"
                          >
                            Gabung
                          </button>
                          <button
                            type="button"
                            disabled={pending || t.count > 0}
                            title={t.count > 0 ? 'Tag masih dipakai — gabungkan, jangan dihapus' : undefined}
                            onClick={() => {
                              if (window.confirm(`Hapus tag "${t.name}"?`)) {
                                run(() => deleteTag({ id: t.id }), `Tag "${t.name}" dihapus.`)
                              }
                            }}
                            className="rounded px-2 py-1 text-xs disabled:opacity-40"
                            style={{ color: 'oklch(0.55 0.19 25)' }}
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs" style={{ color: 'var(--fg-muted)' }}>
        Mengganti nama hanya mengubah label — alamat <code>/tag/&lt;slug&gt;</code> tetap sama agar tautan yang
        sudah tersebar tidak rusak. Untuk memperbaiki slug yang salah, buat tag baru lalu gabungkan tag lama ke
        dalamnya; alamat lama otomatis dialihkan.
      </p>
    </div>
  )
}
