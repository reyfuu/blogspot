import { config } from 'dotenv'

config()
import { defineConfig } from 'prisma/config'

// Prisma 7 memindahkan URL koneksi ke sini (tidak lagi di schema.prisma).
// DIRECT_URL = koneksi langsung (non-pooled) khusus migrasi — lihat TRD TS-11 §11.3.
//
// Mundur ke DATABASE_URL bila DIRECT_URL kosong. Alasannya: `env('DIRECT_URL')`
// gagal keras saat variabelnya tidak ada, dan `prisma generate` adalah langkah
// PERTAMA pada perintah build. Di Vercel — yang tidak pernah menjalankan migrasi
// — itu mematikan seluruh deploy hanya karena variabel yang tidak dipakainya.
// Migrasi tetap memakai DIRECT_URL bila tersedia, dan CI selalu mengisinya.
const migrationUrl = process.env['DIRECT_URL'] || process.env['DATABASE_URL'] || ''

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { seed: 'tsx prisma/seed.ts' },
  datasource: {
    url: migrationUrl,
  },
})
