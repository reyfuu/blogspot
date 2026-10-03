import { db } from './db'

/** Pengaturan situs — FR-083. */
export type SiteSettings = {
  siteName: string
  tagline: string
  description: string
  authorName: string
  authorBio: string
  commentsEnabled: boolean
  guestCommentsEnabled: boolean
  autoCloseCommentsAfterDays: number | null
  postsPerPage: number
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Blogspot',
  tagline: 'Catatan dan tulisan pribadi',
  description: 'Blog pribadi berisi catatan teknis dan esai pendek.',
  authorName: 'Penulis',
  authorBio: '',
  commentsEnabled: true,
  // OQ-3: bawaan mengizinkan komentar tamu; dapat dimatikan dari /admin/settings.
  guestCommentsEnabled: true,
  // OQ-6: null = komentar tidak pernah ditutup otomatis (BRULE-34).
  autoCloseCommentsAfterDays: null,
  postsPerPage: 20,
}

const KEY = 'site'

export async function getSettings(): Promise<SiteSettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } })
  if (!row) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<SiteSettings>) }
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings()
  const next = { ...current, ...patch }
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: next },
    update: { value: next },
  })
  return next
}
