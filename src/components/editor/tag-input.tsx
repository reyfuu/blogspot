'use client'

import { useId, useMemo, useRef, useState } from 'react'

/**
 * Input tag berbasis chip + saran — FR-024.
 *
 * Mengganti kolom teks koma. Akar masalah tag kembar (`nextjs` vs `next-js`)
 * adalah penulis tidak melihat tag yang sudah ada saat mengetik; komponen ini
 * menampilkannya, sehingga tag lama dipakai ulang alih-alih dibuat ulang.
 *
 * Seluruh interaksi dapat dilakukan dengan keyboard (FR-057).
 */

export const MAX_TAGS = 5 // Lampiran A

/** Normalisasi sama dengan sisi server (savePost) agar pratinjau tidak menyesatkan. */
function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function TagInput({
  value,
  onChange,
  available,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  available: { name: string; count: number }[]
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const atLimit = value.length >= MAX_TAGS

  const suggestions = useMemo(() => {
    const q = normalize(draft)
    const chosen = new Set(value.map(normalize))
    return available
      .filter((t) => !chosen.has(normalize(t.name)))
      .filter((t) => (q ? normalize(t.name).includes(q) : true))
      .slice(0, 8)
  }, [draft, value, available])

  function add(raw: string) {
    const name = normalize(raw)
    if (!name || name.length < 2 || name.length > 30) return
    if (atLimit) return
    if (value.some((v) => normalize(v) === name)) return
    onChange([...value, name])
    setDraft('')
    setHighlight(0)
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const picked = open && suggestions[highlight]
      add(picked ? picked.name : draft)
      return
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      removeAt(value.length - 1)
      return
    }
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => (h + 1) % suggestions.length)
      return
    }
    if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault()
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length)
      return
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div>
      <span id={`${listId}-label`} className="block text-sm font-medium">
        Tag
      </span>

      <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Tag terpilih">
        {value.map((t, i) => (
          <li key={t}>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              {t}
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Hapus tag ${t}`}
                className="rounded-full px-0.5 leading-none hover:bg-[var(--bg-subtle)]"
              >
                ×
              </button>
            </span>
          </li>
        ))}
        {value.length === 0 && (
          <li className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            Belum ada tag.
          </li>
        )}
      </ul>

      <div className="relative mt-2">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-labelledby={`${listId}-label`}
          autoComplete="off"
          value={draft}
          disabled={atLimit}
          placeholder={atLimit ? `Maksimal ${MAX_TAGS} tag` : 'Ketik lalu Enter…'}
          onChange={(e) => {
            setDraft(e.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onFocus={() => setOpen(true)}
          // Ditunda agar klik pada saran sempat terproses sebelum daftar ditutup.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="w-full rounded-md border px-2 py-1.5 text-sm disabled:opacity-60"
          style={{ background: 'var(--bg)', color: 'var(--fg)' }}
        />

        {open && suggestions.length > 0 && !atLimit && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border py-1 shadow-lg"
            style={{ background: 'var(--bg)' }}
          >
            {suggestions.map((s, i) => (
              <li key={s.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    add(s.name)
                    inputRef.current?.focus()
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm"
                  style={i === highlight ? { background: 'var(--bg-subtle)' } : undefined}
                >
                  <span>{s.name}</span>
                  <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                    {s.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
        {value.length}/{MAX_TAGS} · pilih dari saran agar tidak membuat tag kembar.
      </p>
    </div>
  )
}
