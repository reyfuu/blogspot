'use client'

import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMedia, updateMediaAlt } from '@/actions/media'

export type MediaItem = {
  id: string
  url: string
  alt: string | null
  mimeType: string
  size: number
  width: number | null
  height: number | null
  usedAsCover: number
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaLibrary({ items, uploadEnabled }: { items: MediaItem[]; uploadEnabled: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      // FR-041: maksimal 5 unggahan bersamaan.
      for (const file of Array.from(files).slice(0, 5)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? 'Gagal mengunggah gambar. Coba lagi.')
          break
        }
      }
      router.refresh()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="mt-6">
      {uploadEnabled && (
        <div>
          <label htmlFor="upload" className="block text-sm font-medium">
            Unggah gambar
          </label>
          <input
            ref={inputRef}
            id="upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            multiple
            disabled={uploading}
            onChange={(e) => void onUpload(e.target.files)}
            className="mt-1 block w-full text-sm"
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
            JPEG, PNG, WebP, AVIF, atau GIF. Maksimal 5 MB per berkas. SVG tidak didukung.
          </p>
          {uploading && <p className="mt-2 text-sm">Mengunggah…</p>}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm" style={{ color: 'oklch(0.55 0.19 25)' }}>
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="py-16 text-center" style={{ color: 'var(--fg-muted)' }}>
          Belum ada media.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-lg border">
              <div className="relative aspect-video" style={{ background: 'var(--bg-subtle)' }}>
                <Image src={m.url} alt={m.alt ?? ''} fill sizes="25vw" className="object-cover" />
              </div>
              <div className="p-3 text-xs">
                <p style={{ color: 'var(--fg-muted)' }}>
                  {formatSize(m.size)} · {m.mimeType.replace('image/', '')}
                </p>

                <label className="mt-2 block">
                  <span className="sr-only">Teks alternatif</span>
                  <input
                    defaultValue={m.alt ?? ''}
                    placeholder="Teks alternatif…"
                    onBlur={(e) => {
                      if (e.target.value !== (m.alt ?? '')) {
                        startTransition(async () => {
                          await updateMediaAlt({ id: m.id, alt: e.target.value })
                          router.refresh()
                        })
                      }
                    }}
                    className="w-full rounded border px-2 py-1"
                    style={{ background: 'var(--bg)', color: 'var(--fg)' }}
                  />
                </label>

                <div className="mt-2 flex items-center justify-between">
                  <code className="truncate" style={{ color: 'var(--fg-muted)' }}>
                    {m.url.split('/').pop()}
                  </code>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      // BRULE-22: peringatkan bila media sedang dipakai.
                      const warning =
                        m.usedAsCover > 0
                          ? `Media ini dipakai sebagai sampul ${m.usedAsCover} artikel. Hapus tetap?`
                          : 'Hapus media ini?'
                      if (window.confirm(warning)) {
                        startTransition(async () => {
                          await deleteMedia({ id: m.id })
                          router.refresh()
                        })
                      }
                    }}
                    className="ml-2 shrink-0 rounded px-1.5 py-0.5"
                    style={{ color: 'oklch(0.55 0.19 25)' }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
