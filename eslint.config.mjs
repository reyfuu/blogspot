import next from 'eslint-config-next'

// eslint-config-next mengekspor ARRAY konfigurasi flat, bukan fungsi.
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'playwright-report/**',
      'prisma/migrations/**',
    ],
  },
  ...next,
]

export default config
