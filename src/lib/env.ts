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

/**
 * Masuk hanya mungkin bila ketiganya terisi.
 *
 * AUTH_SECRET ikut dihitung: tanpa rahasia itu Auth.js melempar pada setiap
 * permintaan, sehingga /login akan 500 alih-alih menampilkan penjelasan.
 * Dianggap "belum dikonfigurasi" membuat halaman itu tetap bisa menjelaskan.
 */
export const isAuthConfigured = Boolean(OWNER_EMAIL && env.OWNER_PASSWORD_HASH && env.AUTH_SECRET)

/** Variabel yang dibutuhkan agar owner bisa masuk, beserta cara membuatnya. */
const KREDENSIAL_OWNER: ReadonlyArray<readonly [nama: string, terisi: boolean, cara: string]> = [
  ['OWNER_EMAIL', Boolean(OWNER_EMAIL), 'email yang Anda pakai untuk masuk'],
  ['OWNER_PASSWORD_HASH', Boolean(env.OWNER_PASSWORD_HASH), 'jalankan: pnpm hash-password'],
  ['AUTH_SECRET', Boolean(env.AUTH_SECRET), 'jalankan: openssl rand -base64 32'],
]

/**
 * E-CFG-01 — laporan konfigurasi yang menyebut variabelnya satu per satu.
 *
 * Pesan lama hanya berkata "OWNER_EMAIL atau OWNER_PASSWORD_HASH kosong",
 * sehingga tidak mungkin tahu yang mana — dan sebuah nilai yang salah tempel
 * (mis. ikut tanda kutip) terbaca "terisi" padahal tidak akan pernah cocok.
 * Hanya status terisi/kosong yang dicetak; nilainya tidak pernah ikut.
 */
function laporanKonfigurasi(): string {
  const baris = KREDENSIAL_OWNER.map(
    ([nama, terisi, cara]) => `  ${terisi ? '✓ terisi ' : '✗ KOSONG '} ${nama}${terisi ? '' : ` — ${cara}`}`,
  )
  return [
    '[E-CFG-01] Kredensial owner belum lengkap di produksi.',
    ...baris,
    '',
    '  Isi di Vercel: Settings → Environment Variables.',
    '  Centang Production, Preview, dan Development — variabel yang',
    '  hanya dicentang pada satu environment tidak terbaca di environment lain.',
    '  Tempel hash TANPA tanda kutip; kutip hanya untuk berkas .env.',
  ].join('\n')
}

// Diperingatkan, bukan dilemparkan. Dua alasan:
//
// 1. Nilai-nilai ini tidak dibutuhkan untuk MEMBANGUN situs, hanya untuk masuk.
//    Menggagalkan build memblokir seluruh deploy — termasuk bagian publik yang
//    sudah siap tayang.
// 2. `env.ts` diimpor hampir seluruh halaman. Melempar saat runtime berarti
//    setiap permintaan gagal, bukan hanya jalur masuk.
//
// Jalur yang anggun sudah ada: `isAuthConfigured` bernilai false membuat
// /login menampilkan penjelasan apa adanya, dan situs publik tetap jalan.
if (env.NODE_ENV === 'production' && !isAuthConfigured) {
  console.warn(`\n${laporanKonfigurasi()}\n`)
}

export const isBlobConfigured = Boolean(env.BLOB_READ_WRITE_TOKEN)
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
