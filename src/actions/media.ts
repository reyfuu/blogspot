'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/guard'
import { AppError, fail, ok, type ActionResult } from '@/lib/errors'
import { deleteImage } from '@/lib/storage'
import { recordAudit } from './audit'

/** FR-042: hapus media. */
export async function deleteMedia(input: unknown): Promise<ActionResult<void>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-04')
  }

  const parsed = z.object({ id: z.string().min(1) }).safeParse(input)
  if (!parsed.success) return fail('E-SYS-01')

  const media = await db.media.findUnique({
    where: { id: parsed.data.id },
    select: { url: true, _count: { select: { coverFor: true } } },
  })
  if (!media) return fail('E-SYS-01')

  try {
    await deleteImage(media.url)
  } catch (error) {
    console.error('[media] gagal menghapus objek penyimpanan', error)
  }

  // BRULE-22: menghapus media TIDAK mengubah isi artikel. Referensi yang
  // menggantung dirender sebagai placeholder di sisi tampilan.
  await db.media.delete({ where: { id: parsed.data.id } })
  await recordAudit(owner.id, 'media.delete', 'Media', parsed.data.id)
  return ok(undefined)
}

/** FR-032/BRULE-17: perbarui teks alternatif. */
export async function updateMediaAlt(input: unknown): Promise<ActionResult<void>> {
  try {
    await requireOwner()
    const parsed = z.object({ id: z.string().min(1), alt: z.string().max(300) }).safeParse(input)
    if (!parsed.success) return fail('E-SYS-01')
    await db.media.update({ where: { id: parsed.data.id }, data: { alt: parsed.data.alt } })
    return ok(undefined)
  } catch (e) {
    return fail(e instanceof AppError ? e.code : 'E-AUTH-04')
  }
}
