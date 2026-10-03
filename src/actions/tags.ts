'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/guard'
import { fail, ok, type ActionResult } from '@/lib/errors'
import { tags } from '@/lib/cache-tags'
import { recordAudit } from './audit'

/**
 * Pengelolaan tag — FR-084.
 *
 * Pola wajib (TS-05 §5.2 lapis 3): requireOwner() → Zod → mutasi →
 * updateTag() → recordAudit(). Tidak ada pengecualian.
 */

/** Membersihkan cache yang terdampak perubahan tag. */
function revalidateTagCaches(...slugs: string[]) {
  for (const s of new Set(slugs)) updateTag(tags.tag(s))
  updateTag(tags.postsList)
  updateTag(tags.sitemap)
  updateTag(tags.feed)
}

/**
 * FR-084: ganti label tag.
 * BRULE-36: hanya `name` yang berubah — slug immutable, sehingga URL
 * /tag/<slug> yang sudah terindeks tidak pernah rusak oleh rename.
 */
export async function renameTag(input: unknown): Promise<ActionResult<void>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-04')
  }

  const parsed = z
    .object({ id: z.string().min(1), name: z.string().trim().min(2).max(30) })
    .safeParse(input)
  if (!parsed.success) return fail('E-POST-06', { message: 'Nama tag harus 2–30 karakter.' })

  const tag = await db.tag.findUnique({ where: { id: parsed.data.id }, select: { slug: true, name: true } })
  if (!tag) return fail('E-SYS-01')

  await db.tag.update({ where: { id: parsed.data.id }, data: { name: parsed.data.name } })
  await recordAudit(owner.id, 'tag.rename', 'Tag', parsed.data.id, { from: tag.name, to: parsed.data.name })

  revalidateTagCaches(tag.slug)
  return ok(undefined)
}

/**
 * FR-084: gabungkan tag sumber ke tag tujuan.
 *
 * Tidak dapat dibatalkan. Dua hal yang mudah salah dan ditangani eksplisit:
 *  - BRULE-37: artikel yang memiliki KEDUA tag akan melanggar primary key
 *    gabungan (postId, tagId) bila relasinya dipindahkan begitu saja.
 *    Relasi bentrok dihapus, bukan dipindahkan.
 *  - BRULE-36: slug sumber disimpan sebagai alias agar URL lamanya 301.
 */
export async function mergeTags(input: unknown): Promise<ActionResult<{ moved: number }>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-04')
  }

  const parsed = z
    .object({ fromId: z.string().min(1), intoId: z.string().min(1) })
    .safeParse(input)
  if (!parsed.success) return fail('E-SYS-01')
  const { fromId, intoId } = parsed.data

  if (fromId === intoId) {
    return fail('E-SYS-01', { message: 'Tag sumber dan tujuan tidak boleh sama.' })
  }

  const [from, into] = await Promise.all([
    db.tag.findUnique({ where: { id: fromId }, select: { id: true, slug: true, name: true } }),
    db.tag.findUnique({ where: { id: intoId }, select: { id: true, slug: true, name: true } }),
  ])
  if (!from || !into) return fail('E-SYS-01')

  const moved = await db.$transaction(async (tx) => {
    const fromLinks = await tx.postTag.findMany({ where: { tagId: fromId }, select: { postId: true } })
    const intoLinks = await tx.postTag.findMany({ where: { tagId: intoId }, select: { postId: true } })
    const alreadyTagged = new Set(intoLinks.map((l) => l.postId))

    const toMove = fromLinks.filter((l) => !alreadyTagged.has(l.postId)).map((l) => l.postId)

    // Relasi yang bentrok dibuang — artikelnya sudah memiliki tag tujuan.
    await tx.postTag.deleteMany({ where: { tagId: fromId } })
    if (toMove.length > 0) {
      await tx.postTag.createMany({ data: toMove.map((postId) => ({ postId, tagId: intoId })) })
    }

    // Slug lama tetap dilayani sebagai pengalihan permanen.
    await tx.tagAlias.upsert({
      where: { slug: from.slug },
      create: { slug: from.slug, tagId: intoId },
      update: { tagId: intoId },
    })
    // Alias yang sebelumnya menunjuk tag sumber ikut diarahkan ulang.
    await tx.tagAlias.updateMany({ where: { tagId: fromId }, data: { tagId: intoId } })

    await tx.tag.delete({ where: { id: fromId } })
    return toMove.length
  })

  await recordAudit(owner.id, 'tag.merge', 'Tag', intoId, {
    from: from.slug,
    into: into.slug,
    movedPosts: moved,
  })

  revalidateTagCaches(from.slug, into.slug)
  return ok({ moved })
}

/**
 * FR-084: hapus tag.
 * Hanya untuk tag yatim — tag yang masih dipakai harus digabungkan, agar
 * artikel tidak diam-diam kehilangan kategorinya.
 */
export async function deleteTag(input: unknown): Promise<ActionResult<void>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-04')
  }

  const parsed = z.object({ id: z.string().min(1) }).safeParse(input)
  if (!parsed.success) return fail('E-SYS-01')

  const tag = await db.tag.findUnique({
    where: { id: parsed.data.id },
    select: { slug: true, _count: { select: { posts: true } } },
  })
  if (!tag) return fail('E-SYS-01')

  if (tag._count.posts > 0) {
    return fail('E-SYS-01', {
      message: `Tag masih dipakai ${tag._count.posts} artikel. Gabungkan ke tag lain, jangan dihapus.`,
    })
  }

  await db.tag.delete({ where: { id: parsed.data.id } })
  await recordAudit(owner.id, 'tag.delete', 'Tag', parsed.data.id, { slug: tag.slug })

  revalidateTagCaches(tag.slug)
  return ok(undefined)
}
