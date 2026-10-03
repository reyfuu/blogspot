import { beforeAll } from 'vitest'

beforeAll(() => {
  if (!process.env['DATABASE_URL']) {
    throw new Error('DATABASE_URL belum diset. Jalankan lewat: pnpm test:integration')
  }
})
