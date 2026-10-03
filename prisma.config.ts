import { config } from 'dotenv'

config()
import { defineConfig, env } from 'prisma/config'

// Prisma 7 memindahkan URL koneksi ke sini (tidak lagi di schema.prisma).
// DIRECT_URL = koneksi langsung (non-pooled) khusus migrasi — lihat TRD TS-11 §11.3.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { seed: 'tsx prisma/seed.ts' },
  datasource: {
    url: env('DIRECT_URL'),
  },
})
