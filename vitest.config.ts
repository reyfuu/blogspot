import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

// Uji integrasi memerlukan DATABASE_URL. Dimuat di sini agar `pnpm test:*`
// berjalan tanpa pembungkus CLI tambahan.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          // Shiki memuat grammar pada pemanggilan pertama (~6s).
          testTimeout: 20000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/integration/setup.ts'],
          fileParallelism: false,
          testTimeout: 30000,
        },
      },
    ],
  },
})
