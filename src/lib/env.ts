import { z } from 'zod'

/**
 * Validasi variabel lingkungan saat start.
 * FR-003 / E-CFG-01: aplikasi menolak start di produksi bila OWNER_EMAILS kosong,
 * karena tanpa itu tidak ada seorang pun yang bisa memperoleh peran OWNER (BRULE-01).
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  DIRECT_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
  OWNER_EMAILS: z.string().default(''),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  throw new Error(
    `[E-CFG-01] Konfigurasi lingkungan tidak valid:\n${parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')}`,
  )
}

export const env = parsed.data

/** Daftar email yang berhak atas peran OWNER. Dinormalisasi ke huruf kecil. */
export const OWNER_EMAILS: readonly string[] = env.OWNER_EMAILS.split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

if (env.NODE_ENV === 'production' && OWNER_EMAILS.length === 0) {
  throw new Error(
    '[E-CFG-01] OWNER_EMAILS kosong di produksi. Tanpa ini tidak ada akun yang bisa menjadi OWNER (BRULE-01).',
  )
}

export const isGitHubAuthConfigured = Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET)
export const isBlobConfigured = Boolean(env.BLOB_READ_WRITE_TOKEN)
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
