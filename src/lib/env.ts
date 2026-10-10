import { z } from 'zod'

/**
 * Validasi variabel lingkungan saat start.
 * FR-003 / E-CFG-01: aplikasi menolak start di produksi bila kredensial owner
 * belum lengkap, karena tanpa itu tidak ada seorang pun yang bisa memperoleh
 * peran OWNER (BRULE-01).
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  DIRECT_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  /** Satu-satunya akun yang boleh masuk. Blog ini single-author (BR-01). */
  OWNER_EMAIL: z.string().default(''),
  /** Keluaran `pnpm hash-password`. Kata sandi mentah tidak pernah disimpan. */
  OWNER_PASSWORD_HASH: z.string().default(''),
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

/** Email owner, dinormalisasi. String kosong berarti belum dikonfigurasi. */
export const OWNER_EMAIL = env.OWNER_EMAIL.trim().toLowerCase()

/** Masuk hanya mungkin bila email DAN hash kata sandi sama-sama terisi. */
export const isAuthConfigured = Boolean(OWNER_EMAIL && env.OWNER_PASSWORD_HASH)

if (env.NODE_ENV === 'production') {
  if (!isAuthConfigured) {
    throw new Error(
      '[E-CFG-01] OWNER_EMAIL atau OWNER_PASSWORD_HASH kosong di produksi. ' +
        'Tanpa keduanya tidak ada akun yang bisa menjadi OWNER (BRULE-01). ' +
        'Hasilkan hash dengan: pnpm hash-password',
    )
  }
  // Auth.js menandatangani sesi JWT dengan rahasia ini. Tanpa itu build tetap
  // lolos tetapi SETIAP permintaan ke jalur auth gagal di produksi — lebih baik
  // ketahuan saat build daripada di depan pengguna.
  if (!env.AUTH_SECRET) {
    throw new Error(
      '[E-CFG-01] AUTH_SECRET kosong di produksi. Sesi tidak dapat ditandatangani. ' +
        'Hasilkan dengan: openssl rand -base64 32',
    )
  }
}

export const isBlobConfigured = Boolean(env.BLOB_READ_WRITE_TOKEN)
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
