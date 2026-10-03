'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { submitComment } from '@/actions/comments'

/**
 * Formulir komentar — FR-070/071/072.
 *
 * Satu-satunya komponen klien pada halaman artikel. Halaman tetap dapat dibaca
 * sepenuhnya tanpa JavaScript (BRULE-23); hanya pengiriman komentar yang butuh JS.
 */
export function CommentForm({ postId, guestAllowed }: { postId: string; guestAllowed: boolean }) {
  // FR-072 lapis 2: catat kapan formulir siap dipakai, untuk mendeteksi
  // pengiriman yang terlalu cepat (ciri bot). Diisi di effect, bukan saat
  // render — Date.now() adalah fungsi tak murni.
  const renderedAt = useRef(0)
  useEffect(() => {
    renderedAt.current = Date.now()
  }, [])
  const formRef = useRef<HTMLFormElement>(null)

  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'error'; message?: string }>({ kind: 'idle' })

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await submitComment({
        postId,
        body: String(fd.get('body') ?? ''),
        guestName: String(fd.get('guestName') ?? ''),
        guestEmail: String(fd.get('guestEmail') ?? ''),
        honeypot: String(fd.get('website') ?? ''),
        renderedAt: renderedAt.current,
      })

      if (result.ok) {
        // FR-042 (US-042): beri tahu bahwa komentar menunggu moderasi, agar
        // pengirim tidak mengirim berulang kali.
        setStatus({ kind: 'ok', message: 'Komentar terkirim dan sedang menunggu moderasi. Terima kasih!' })
        formRef.current?.reset()
      } else {
        setStatus({ kind: 'error', message: result.message })
      }
    })
  }

  if (status.kind === 'ok') {
    return (
      <p role="status" className="rounded-md border px-4 py-3 text-sm" style={{ background: 'var(--bg-subtle)' }}>
        {status.message}
      </p>
    )
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <h3 className="font-medium">Tinggalkan komentar</h3>

      {guestAllowed && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="guestName" className="block text-sm font-medium">
              Nama
            </label>
            <input
              id="guestName"
              name="guestName"
              required
              minLength={2}
              maxLength={60}
              autoComplete="name"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={{ background: 'var(--bg)', color: 'var(--fg)' }}
            />
          </div>
          <div>
            <label htmlFor="guestEmail" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="guestEmail"
              name="guestEmail"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              style={{ background: 'var(--bg)', color: 'var(--fg)' }}
            />
            {/* BRULE-30: email tidak pernah ditampilkan publik. */}
            <p className="mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
              Tidak akan ditampilkan publik.
            </p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="body" className="block text-sm font-medium">
          Komentar
        </label>
        <textarea
          id="body"
          name="body"
          required
          minLength={3}
          maxLength={3000}
          rows={5}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--bg)', color: 'var(--fg)' }}
        />
      </div>

      {/* FR-072 lapis 1: honeypot. Disembunyikan dari mata DAN dari pembaca layar,
          tapi tetap terisi oleh bot yang mengisi semua field. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === 'error' && (
        <p role="alert" className="text-sm" style={{ color: 'oklch(0.55 0.19 25)' }}>
          {status.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-[var(--bg-subtle)] disabled:opacity-60"
        >
          {pending ? 'Mengirim…' : 'Kirim komentar'}
        </button>
        <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
          Komentar ditampilkan setelah disetujui.
        </span>
      </div>
    </form>
  )
}
