import { createHash } from 'node:crypto'
import { db } from './db'

/**
 * Pembatasan laju komentar — FR-072 lapis 3.
 * Implementasi berbasis Postgres agar tidak menambah vendor (TS-02).
 * Upstash Redis dapat menggantikan ini tanpa mengubah pemanggil.
 */
export const COMMENT_LIMIT = 5
export const COMMENT_WINDOW_MS = 10 * 60 * 1000

/** Tidak pernah menyimpan IP atau email mentah — hanya hash (BRULE-30, C-5). */
export function hashIdentifier(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 32)
}

export async function isCommentRateLimited(ipHash: string, emailHash?: string | null): Promise<boolean> {
  const since = new Date(Date.now() - COMMENT_WINDOW_MS)
  const count = await db.comment.count({
    where: {
      createdAt: { gte: since },
      OR: [{ ipHash }, ...(emailHash ? [{ guestEmailHash: emailHash }] : [])],
    },
  })
  return count >= COMMENT_LIMIT
}
