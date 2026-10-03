'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { moderateComment } from '@/actions/comments'

export type ModerationItem = {
  id: string
  body: string
  status: string
  createdAt: string
  authorName: string
  authorEmail: string | null
  isOwner: boolean
  postTitle: string
  postSlug: string
}

/**
 * FR-074: aksi moderasi, mendukung banyak komentar sekaligus.
 * Tujuannya memungkinkan seluruh antrian diputuskan dari satu layar (FR-073).
 */
export function ModerationQueue({ comments }: { comments: ModerationItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const allSelected = comments.length > 0 && selected.size === comments.length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function act(ids: string[], action: 'approve' | 'reject' | 'spam' | 'delete') {
    if (ids.length === 0) return
    // BRULE-33: hapus permanen perlu konfirmasi eksplisit dan tidak bisa dibatalkan.
    if (action === 'delete' && !window.confirm(`Hapus permanen ${ids.length} komentar? Tindakan ini tidak dapat dibatalkan.`)) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await moderateComment({ ids, action })
      if (result.ok) {
        setSelected(new Set())
        router.refresh()
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="mt-6">
      {error && (
        <p role="alert" className="mb-4 text-sm" style={{ color: 'oklch(0.55 0.19 25)' }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => setSelected(e.target.checked ? new Set(comments.map((c) => c.id)) : new Set())}
            className="size-4"
          />
          Pilih semua
        </label>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              {selected.size} dipilih
            </span>
            <BulkBtn disabled={pending} onClick={() => act([...selected], 'approve')}>
              Setujui
            </BulkBtn>
            <BulkBtn disabled={pending} onClick={() => act([...selected], 'reject')}>
              Tolak
            </BulkBtn>
            <BulkBtn disabled={pending} onClick={() => act([...selected], 'spam')}>
              Spam
            </BulkBtn>
            <BulkBtn disabled={pending} danger onClick={() => act([...selected], 'delete')}>
              Hapus permanen
            </BulkBtn>
          </div>
        )}
      </div>

      <ul className="divide-y">
        {comments.map((c) => (
          <li key={c.id} className="py-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="mt-1 size-4 shrink-0"
                aria-label={`Pilih komentar dari ${c.authorName}`}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium">{c.authorName}</span>
                  {c.isOwner && (
                    <span className="rounded-full border px-2 text-xs" style={{ color: 'var(--accent)' }}>
                      Penulis
                    </span>
                  )}
                  {c.authorEmail && (
                    <span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
                      {c.authorEmail}
                    </span>
                  )}
                  <span style={{ color: 'var(--fg-muted)' }}>· {c.createdAt}</span>
                  <span className="rounded border px-1.5 text-xs">{c.status}</span>
                </div>

                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{c.body}</p>

                <p className="mt-2 text-xs" style={{ color: 'var(--fg-muted)' }}>
                  pada{' '}
                  <Link href={`/post/${c.postSlug}`} className="underline">
                    {c.postTitle}
                  </Link>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.status !== 'APPROVED' && (
                    <RowBtn disabled={pending} onClick={() => act([c.id], 'approve')}>
                      Setujui
                    </RowBtn>
                  )}
                  {c.status !== 'REJECTED' && (
                    <RowBtn disabled={pending} onClick={() => act([c.id], 'reject')}>
                      Tolak
                    </RowBtn>
                  )}
                  {c.status !== 'SPAM' && (
                    <RowBtn disabled={pending} onClick={() => act([c.id], 'spam')}>
                      Spam
                    </RowBtn>
                  )}
                  <RowBtn disabled={pending} danger onClick={() => act([c.id], 'delete')}>
                    Hapus
                  </RowBtn>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BulkBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border px-3 py-1 text-sm hover:bg-[var(--bg-subtle)] disabled:opacity-60"
      style={danger ? { color: 'oklch(0.55 0.19 25)' } : undefined}
    >
      {children}
    </button>
  )
}

function RowBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-subtle)] disabled:opacity-60"
      style={danger ? { color: 'oklch(0.55 0.19 25)' } : undefined}
    >
      {children}
    </button>
  )
}
