'use client'

import { useState, useTransition } from 'react'
import { updateSettings } from '@/actions/settings'
import type { SiteSettings } from '@/lib/settings'

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [form, setForm] = useState(initial)
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'error'; message?: string }>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setStatus({ kind: 'idle' })
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateSettings(form)
      setStatus(
        result.ok
          ? { kind: 'ok', message: 'Pengaturan tersimpan.' }
          : { kind: 'error', message: result.message },
      )
    })
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-8">
      <fieldset className="space-y-4">
        <legend className="font-semibold">Identitas situs</legend>
        <Field id="siteName" label="Nama blog">
          <input id="siteName" value={form.siteName} onChange={(e) => set('siteName', e.target.value)} className={inputCls} style={inputStyle} required maxLength={100} />
        </Field>
        <Field id="tagline" label="Tagline">
          <input id="tagline" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} className={inputCls} style={inputStyle} maxLength={200} />
        </Field>
        <Field id="description" label="Deskripsi" hint="Dipakai sebagai meta description bawaan.">
          <textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className={inputCls} style={inputStyle} maxLength={500} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-semibold">Penulis</legend>
        <Field id="authorName" label="Nama tampilan">
          <input id="authorName" value={form.authorName} onChange={(e) => set('authorName', e.target.value)} className={inputCls} style={inputStyle} required maxLength={100} />
        </Field>
        <Field id="authorBio" label="Bio" hint="Tampil di halaman Tentang.">
          <textarea id="authorBio" value={form.authorBio} onChange={(e) => set('authorBio', e.target.value)} rows={3} className={inputCls} style={inputStyle} maxLength={500} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-semibold">Komentar</legend>

        <label className="flex items-start gap-2">
          <input type="checkbox" checked={form.commentsEnabled} onChange={(e) => set('commentsEnabled', e.target.checked)} className="mt-1 size-4" />
          <span className="text-sm">
            Aktifkan komentar
            <span className="block text-xs" style={{ color: 'var(--fg-muted)' }}>
              Seluruh komentar tetap wajib disetujui sebelum tampil.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input type="checkbox" checked={form.guestCommentsEnabled} onChange={(e) => set('guestCommentsEnabled', e.target.checked)} className="mt-1 size-4" />
          <span className="text-sm">
            Izinkan komentar tamu
            <span className="block text-xs" style={{ color: 'var(--fg-muted)' }}>
              Tamu mengisi nama dan email. Email tidak pernah ditampilkan publik.
            </span>
          </span>
        </label>

        <Field id="autoClose" label="Tutup komentar otomatis setelah (hari)" hint="Biarkan kosong agar komentar tidak pernah ditutup otomatis.">
          <input
            id="autoClose"
            type="number"
            min={1}
            max={3650}
            value={form.autoCloseCommentsAfterDays ?? ''}
            onChange={(e) => set('autoCloseCommentsAfterDays', e.target.value === '' ? null : Number(e.target.value))}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-semibold">Tampilan</legend>
        <Field id="postsPerPage" label="Artikel per halaman">
          <input id="postsPerPage" type="number" min={5} max={50} value={form.postsPerPage} onChange={(e) => set('postsPerPage', Number(e.target.value))} className={inputCls} style={inputStyle} />
        </Field>
      </fieldset>

      {status.kind !== 'idle' && (
        <p
          role={status.kind === 'error' ? 'alert' : 'status'}
          className="text-sm"
          style={status.kind === 'error' ? { color: 'oklch(0.55 0.19 25)' } : undefined}
        >
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        style={{ background: 'var(--accent)', color: 'white' }}
      >
        {pending ? 'Menyimpan…' : 'Simpan pengaturan'}
      </button>
    </form>
  )
}

const inputCls = 'mt-1 w-full rounded-md border px-3 py-2 text-sm'
const inputStyle = { background: 'var(--bg)', color: 'var(--fg)' } as const

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}
