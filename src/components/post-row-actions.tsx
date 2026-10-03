'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archivePost, restorePost, trashPost } from '@/actions/posts'

/** FR-081: aksi cepat per baris artikel. */
export function PostRowActions({ id, status, slug }: { id: string; status: string; slug: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function run(fn: typeof archivePost, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    startTransition(async () => {
      await fn({ id })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {status === 'PUBLISHED' && (
        <a
          href={`/post/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-subtle)]"
        >
          Lihat
        </a>
      )}
      {status === 'TRASHED' ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(restorePost)}
          className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-subtle)] disabled:opacity-60"
        >
          Pulihkan
        </button>
      ) : (
        <>
          {status === 'PUBLISHED' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(archivePost, 'Arsipkan artikel ini? Artikel akan hilang dari situs publik.')}
              className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-subtle)] disabled:opacity-60"
            >
              Arsipkan
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(trashPost, 'Pindahkan ke tempat sampah? Masih bisa dipulihkan.')}
            className="rounded px-2 py-1 text-xs disabled:opacity-60"
            style={{ color: 'oklch(0.55 0.19 25)' }}
          >
            Hapus
          </button>
        </>
      )}
    </div>
  )
}
