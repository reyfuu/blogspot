import { requireOwner } from '@/lib/guard'
import { getSettings } from '@/lib/settings'
import { SettingsForm } from '@/components/settings-form'

/** FR-083: pengaturan situs. */
export default async function AdminSettingsPage() {
  await requireOwner()
  const settings = await getSettings()

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
      <SettingsForm initial={settings} />

      <section className="mt-12 border-t pt-6">
        <h2 className="text-lg font-semibold">Ekspor konten</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
          Mengunduh seluruh artikel sebagai Markdown beserta front matter. Ini mekanisme keluar Anda —
          konten tetap portabel apa pun yang terjadi pada platform ini.
        </p>
        <a
          href="/api/export"
          className="mt-3 inline-block rounded-md border px-4 py-2 text-sm font-medium hover:bg-[var(--bg-subtle)]"
        >
          Unduh ekspor Markdown
        </a>
      </section>
    </div>
  )
}
