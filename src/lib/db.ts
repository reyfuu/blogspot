import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@/generated/prisma/client'
import { env } from './env'

/**
 * Singleton Prisma dengan driver adapter Neon (TS-02, TR-1).
 * Prisma 7 mewajibkan adapter pada konstruktor — URL tidak lagi dibaca dari schema.
 * Memakai koneksi pooled agar tidak kehabisan koneksi di runtime serverless.
 */
/**
 * Driver Neon membuka koneksi pooled lewat **WebSocket**, dan mengandalkan
 * `globalThis.WebSocket` yang baru tersedia sejak Node 22 — di Node 20 objek itu
 * tidak ada. Kegagalannya tidak menyebut apa pun soal versi Node; yang muncul
 * hanyalah `prisma:error undefined` diikuti `ErrorEvent { type: 'error' }`,
 * lalu Next merangkumnya menjadi "Failed to collect page data".
 *
 * Sangat mungkin terjadi di CI/hosting yang memilih versi Node lebih lama
 * daripada mesin pengembang, jadi diperiksa di depan.
 */
function pastikanWebSocketTersedia(): void {
  if (typeof globalThis.WebSocket !== 'undefined') return
  throw new Error(
    [
      `[E-CFG-02] Node ${process.version} tidak menyediakan WebSocket bawaan,`,
      '  padahal driver Neon membutuhkannya untuk koneksi pooled.',
      '',
      '  Pakai Node 22.12 atau lebih baru. Di Vercel: Settings → General →',
      '  Node.js Version. Berkas package.json sudah menuntutnya lewat "engines".',
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
