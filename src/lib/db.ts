import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@/generated/prisma/client'
import { env } from './env'

/**
 * Singleton Prisma dengan driver adapter Neon (TS-02, TR-1).
 * Prisma 7 mewajibkan adapter pada konstruktor — URL tidak lagi dibaca dari schema.
 * Memakai koneksi pooled agar tidak kehabisan koneksi di runtime serverless.
 */
/**
 * Driver Neon membuka koneksi pooled lewat **WebSocket** dan mengandalkan
 * `globalThis.WebSocket`, yang baru tersedia sejak Node 22.
 *
 * Yang terdampak adalah jalur **Node polos**: `pnpm db:seed`, `pnpm db:deploy`,
 * dan skrip sekali jalan. Terukur di Node 20.20.2 — driver gagal dengan
 * "All attempts to open a WebSocket to connect to the database failed".
 *
 * Build dan runtime Next TIDAK terdampak: Next menyediakan WebSocket-nya
 * sendiri, dan `next build` terverifikasi sukses di Node 20. Pemeriksaan ini
 * karena itu hanya menjaga jalur skrip, bukan jalur aplikasi.
 */
function pastikanWebSocketTersedia(): void {
  if (typeof globalThis.WebSocket !== 'undefined') return
  throw new Error(
    [
      `[E-CFG-02] Node ${process.version} tidak menyediakan WebSocket bawaan,`,
      '  padahal driver Neon membutuhkannya untuk koneksi pooled.',
      '',
      '  Pakai Node 22.12 atau lebih baru (lihat "engines" di package.json).',
    ].join('\n'),
  )
}

const createClient = () => {
  pastikanWebSocketTersedia()
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> }

export const db = globalForPrisma.prisma ?? createClient()

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = db
