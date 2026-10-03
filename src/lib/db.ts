import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@/generated/prisma/client'
import { env } from './env'

/**
 * Singleton Prisma dengan driver adapter Neon (TS-02, TR-1).
 * Prisma 7 mewajibkan adapter pada konstruktor — URL tidak lagi dibaca dari schema.
 * Memakai koneksi pooled agar tidak kehabisan koneksi di runtime serverless.
 */
const createClient = () =>
  new PrismaClient({
    adapter: new PrismaNeon({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> }

export const db = globalForPrisma.prisma ?? createClient()

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = db
