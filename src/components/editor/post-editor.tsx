'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { autosavePost, publishPost, savePost, archivePost, trashPost, unpublishPost } from '@/actions/posts'
import { TagInput } from './tag-input'

// Editor dimuat hanya di klien: ini satu-satunya bundel berat, dan hanya owner
// yang memuatnya. Rute publik tidak terpengaruh (anggaran TS-10).
const TiptapEditor = dynamic(() => import('./tiptap-editor').then((m) => m.TiptapEditor), {
  ssr: false,
  loading: () => <div className="min-h-[28rem] rounded-lg border p-4 text-sm">Memuat editor…</div>,
})

const AUTOSAVE_DEBOUNCE_MS = 3000 // FR-021

export type PostEditorData = {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  status: string
  tagNames: string[]
  previewToken: string
  commentsClosed: boolean
  readingTime: number
  wordCount: number
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string }

export function PostEditor({
  post,
  availableTags,
}: {
  post: PostEditorData
  availableTags: { name: string; count: number }[]
}) {
  const [title, setTitle] = useState(post.title)
  const [slug, setSlug] = useState(post.slug)
  const [excerpt, setExcerpt] = useState(post.excerpt)
  const [content, setContent] = useState(post.content)
  const [tagNames, setTagNames] = useState<string[]>(post.tagNames)
  const [commentsClosed, setCommentsClosed] = useState(post.commentsClosed)
  const [words, setWords] = useState(post.wordCount)

  const [autosaveState, setAutosaveState] = useState<SaveState>({ kind: 'idle' })
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Menandai apakah ada perubahan yang belum tersimpan (untuk peringatan keluar).
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Nilai terbaru untuk dibaca oleh timer autosave. Disinkronkan di effect,
  // bukan saat render — menulis ref selama render tidak aman.
  const latestRef = useRef({ title, content })
  useEffect(() => {
    latestRef.current = { title, content }
  }, [title, content])

  // Autosave memanggil dirinya sendiri saat gagal (percobaan ulang). Referensi
  // disimpan di ref agar tidak perlu mengacu variabel sebelum dideklarasikan.
  const scheduleRef = useRef<() => void>(() => {})

  /** FR-021: autosave setelah jeda 3 detik sejak ketikan terakhir. */
  const scheduleAutosave = useCallback(() => {
    dirtyRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setAutosaveState({ kind: 'saving' })
      const result = await autosavePost({
        id: post.id,
        title: latestRef.current.title,
        content: latestRef.current.content,
      })
      if (result.ok) {
        dirtyRef.current = false
        setAutosaveState({ kind: 'saved', at: new Date(result.data.savedAt) })
      } else {
        // E-POST-05: isi tetap dipertahankan di klien; percobaan ulang dijadwalkan.
        setAutosaveState({ kind: 'error', message: result.message })
        timerRef.current = setTimeout(() => scheduleRef.current(), 10000)
      }
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [post.id])

  useEffect(() => {
    scheduleRef.current = scheduleAutosave
  }, [scheduleAutosave])

  /** FR-021: peringatan sebelum meninggalkan halaman dengan perubahan tak tersimpan. */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  useEffect(() => () => void (timerRef.current && clearTimeout(timerRef.current)), [])

  function clearErrors() {
    setFormError(null)
    setFieldErrors({})
    setNotice(null)
  }

  function onSave() {
    clearErrors()
    startTransition(async () => {
      const result = await savePost({
        id: post.id,
        title,
        slug,
        excerpt,
        content,
        tagNames,
        commentsClosed,
      })
      if (result.ok) {
        dirtyRef.current = false
        setSlug(result.data.slug)
        setAutosaveState({ kind: 'saved', at: new Date() })
        setNotice('Tersimpan.')
      } else {
        setFormError(result.message)
        setFieldErrors(result.fields ?? {})
      }
    })
  }

  function onPublish(mode: 'now' | 'schedule', scheduledAt?: string) {
    clearErrors()
    startTransition(async () => {
      // Simpan dulu agar yang terbit adalah isi terbaru.
      const saved = await savePost({
        id: post.id,
        title,
        slug,
        excerpt,
        content,
        tagNames,
        commentsClosed,
      })
      if (!saved.ok) {
        setFormError(saved.message)
        setFieldErrors(saved.fields ?? {})
        return
      }

      const result = await publishPost({ id: post.id, mode, scheduledAt })
      if (result.ok) {
        dirtyRef.current = false
        setNotice(mode === 'now' ? 'Artikel terbit.' : 'Artikel dijadwalkan.')
      } else {
        setFormError(result.message)
      }
    })
  }

  function onTransition(fn: typeof archivePost, label: string) {
    clearErrors()
    startTransition(async () => {
      const result = await fn({ id: post.id })
      if (result.ok) setNotice(label)
      else setFormError(result.message)
    })
  }

  const isPublished = post.status === 'PUBLISHED'
  const slugLocked = isPublished

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        <label htmlFor="title" className="sr-only">
          Judul artikel
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            // FR-023: slug mengikuti judul selama artikel belum pernah terbit.
            if (!slugLocked && (slug === '' || slug === 'tanpa-judul')) {
              setSlug(
                e.target.value
                  .toLowerCase()
                  .normalize('NFKD')
                  .replace(/[^a-z0-9\s-]/g, '')
                  .trim()
                  .replace(/\s+/g, '-')
                  .slice(0, 120),
              )
            }
            scheduleAutosave()
          }}
          placeholder="Judul artikel"
          className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:opacity-40"
        />
        {fieldErrors['title'] && (
          <p role="alert" className="mt-1 text-sm" style={{ color: 'oklch(0.55 0.19 25)' }}>
            {fieldErrors['title']}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--fg-muted)' }}>
          {/* FR-034: jumlah kata & waktu baca, diperbarui saat mengetik. */}
          <span>{words} kata</span>
          <span aria-hidden="true">·</span>
          <span>{Math.max(1, Math.ceil(words / 200))} menit baca</span>
          <span aria-hidden="true">·</span>
          <AutosaveIndicator state={autosaveState} />
        </div>

        <div className="mt-6">
          <TiptapEditor
            initialMarkdown={post.content}
            onChange={(md) => {
              setContent(md)
              scheduleAutosave()
            }}
            onWordCount={setWords}
          />
        </div>
      </div>

      <aside className="space-y-6">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Status</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
            {post.status}
          </p>

          {notice && (
            <p role="status" className="mt-3 rounded-md border px-3 py-2 text-sm" style={{ background: 'var(--bg-subtle)' }}>
              {notice}
            </p>
          )}
          {formError && (
            <p role="alert" className="mt-3 text-sm" style={{ color: 'oklch(0.55 0.19 25)' }}>
              {formError}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-[var(--bg-subtle)] disabled:opacity-60"
            >
              Simpan
            </button>

            {!isPublished && (
              <button
                type="button"
                onClick={() => onPublish('now')}
                disabled={pending}
                className="rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                Terbitkan sekarang
              </button>
            )}

            <ScheduleControl disabled={pending} onSchedule={(iso) => onPublish('schedule', iso)} />

            <a
              href={`/preview/${post.id}?token=${post.previewToken}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-2 text-center text-sm hover:bg-[var(--bg-subtle)]"
            >
              Buka pratinjau ↗
            </a>

            {isPublished && (
              <>
                <a
                  href={`/post/${slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border px-3 py-2 text-center text-sm hover:bg-[var(--bg-subtle)]"
                >
                  Lihat publik ↗
                </a>
                <button
                  type="button"
                  onClick={() => onTransition(unpublishPost, 'Artikel ditarik kembali ke draf.')}
                  disabled={pending}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--bg-subtle)] disabled:opacity-60"
                >
                  Tarik kembali ke draf
                </button>
                <button
                  type="button"
                  onClick={() => onTransition(archivePost, 'Artikel diarsipkan.')}
                  disabled={pending}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--bg-subtle)] disabled:opacity-60"
                >
                  Arsipkan
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Pindahkan artikel ini ke tempat sampah? Masih bisa dipulihkan.')) {
                  onTransition(trashPost, 'Artikel dipindahkan ke tempat sampah.')
                }
              }}
              disabled={pending}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-60"
              style={{ color: 'oklch(0.55 0.19 25)' }}
            >
              Hapus
            </button>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Metadata</h2>

          <div className="mt-3">
            <label htmlFor="slug" className="block text-sm font-medium">
              Slug
            </label>
            <input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full rounded-md border px-2 py-1.5 font-mono text-xs"
              style={{ background: 'var(--bg)', color: 'var(--fg)' }}
            />
            {/* BRULE-08: peringatan eksplisit sebelum mengubah slug artikel terbit. */}
            {slugLocked && (
              <p className="mt-1 text-xs" style={{ color: 'oklch(0.58 0.14 70)' }}>
                Artikel sudah terbit. Mengubah slug akan membuat pengalihan permanen dari URL lama.
              </p>
            )}
            {fieldErrors['slug'] && (
              <p role="alert" className="mt-1 text-xs" style={{ color: 'oklch(0.55 0.19 25)' }}>
                {fieldErrors['slug']}
              </p>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="excerpt" className="block text-sm font-medium">
              Ringkasan
            </label>
            <textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Dibuat otomatis bila dibiarkan kosong."
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
              style={{ background: 'var(--bg)', color: 'var(--fg)' }}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
              {excerpt.length}/300
            </p>
          </div>

          <div className="mt-4">
            <TagInput value={tagNames} onChange={setTagNames} available={availableTags} />
            {fieldErrors['tagNames'] && (
              <p role="alert" className="mt-1 text-xs" style={{ color: 'oklch(0.55 0.19 25)' }}>
                {fieldErrors['tagNames']}
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              id="commentsClosed"
              type="checkbox"
              checked={commentsClosed}
              onChange={(e) => setCommentsClosed(e.target.checked)}
              className="size-4"
            />
            <label htmlFor="commentsClosed" className="text-sm">
              Tutup komentar
            </label>
          </div>
        </div>
      </aside>
    </div>
  )
}

function AutosaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === 'saving') return <span>Menyimpan…</span>
  if (state.kind === 'saved') {
    return (
      <span>
        Tersimpan{' '}
        {state.at.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
      </span>
    )
  }
  if (state.kind === 'error') {
    return (
      <span role="alert" style={{ color: 'oklch(0.55 0.19 25)' }}>
        Gagal menyimpan — mencoba lagi
      </span>
    )
  }
  return <span>Belum ada perubahan</span>
}

function ScheduleControl({
  disabled,
  onSchedule,
}: {
  disabled: boolean
  onSchedule: (iso: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-md border px-3 py-2 text-sm hover:bg-[var(--bg-subtle)] disabled:opacity-60"
      >
        Jadwalkan…
      </button>
    )
  }

  return (
    <div className="rounded-md border p-3">
      <label htmlFor="scheduledAt" className="block text-sm font-medium">
        Waktu terbit
      </label>
      <input
        id="scheduledAt"
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
        style={{ background: 'var(--bg)', color: 'var(--fg)' }}
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={disabled || !value}
          onClick={() => onSchedule(new Date(value).toISOString())}
          className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
        >
          Jadwalkan
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm">
          Batal
        </button>
      </div>
    </div>
  )
}
