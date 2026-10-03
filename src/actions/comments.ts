'use server'

import { headers } from 'next/headers'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser, requireOwner } from '@/lib/guard'
import { fail, ok, type ActionResult } from '@/lib/errors'
import { tags } from '@/lib/cache-tags'
import { hashIdentifier, isCommentRateLimited } from '@/lib/ratelimit'
import { getSettings } from '@/lib/settings'
import { recordAudit } from './audit'

/** Komentar — FR-070…FR-076. */

const MIN_FILL_MS = 2000 // FR-072 lapis 2: ambang waktu pengisian minimum
const MAX_LINKS = 3 // Lampiran A

const submitSchema = z.object({
  postId: z.string().min(1),
  body: z.string().trim().min(3, 'Komentar harus 3–3.000 karakter').max(3000),
  parentId: z.string().optional().or(z.literal('')),
  guestName: z.string().trim().min(2).max(60).optional().or(z.literal('')),
  guestEmail: z.string().trim().email().optional().or(z.literal('')),
  honeypot: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
})

function countLinks(text: string): number {
  return (text.match(/https?:\/\//gi) ?? []).length
}

/**
 * FR-070/071: kirim komentar.
 *
 * BRULE-31: hasil akhir SELALU status PENDING. Tidak ada jalur apa pun di v1
 * yang membuat komentar langsung tampil publik tanpa persetujuan owner.
 */
export async function submitComment(input: unknown): Promise<ActionResult<{ pending: true }>> {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    if (issue?.path[0] === 'guestEmail') return fail('E-CMT-03')
    return fail('E-CMT-01')
  }
  const { postId, body, parentId, guestName, guestEmail, honeypot, renderedAt } = parsed.data

  // FR-072 lapis 1: honeypot → tolak DIAM-DIAM dengan konfirmasi palsu,
  // agar bot tidak belajar bahwa ia terdeteksi.
  if (honeypot && honeypot.trim() !== '') return ok({ pending: true })

  // FR-072 lapis 2: formulir dikirim terlalu cepat setelah dimuat.
  if (renderedAt && Date.now() - renderedAt < MIN_FILL_MS) return ok({ pending: true })

  // FR-072 lapis 4: batas jumlah tautan.
  if (countLinks(body) > MAX_LINKS) return fail('E-CMT-02')

  const settings = await getSettings()
  if (!settings.commentsEnabled) return fail('E-CMT-05')

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { slug: true, status: true, commentsClosed: true, publishedAt: true },
  })
  if (!post || post.status !== 'PUBLISHED') return fail('E-SYS-01')
  if (post.commentsClosed) return fail('E-CMT-05')

  // BRULE-34: penutupan otomatis setelah N hari bila dikonfigurasi.
  if (settings.autoCloseCommentsAfterDays !== null && post.publishedAt) {
    const closeAfter = settings.autoCloseCommentsAfterDays * 24 * 60 * 60 * 1000
    if (Date.now() - post.publishedAt.getTime() > closeAfter) return fail('E-CMT-05')
  }

  const user = await getSessionUser()
  if (!user) {
    if (!settings.guestCommentsEnabled) return fail('E-CMT-05')
    if (!guestName || !guestEmail) return fail('E-CMT-03')
  }

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
  const ipHash = hashIdentifier(ip)
  const emailHash = !user && guestEmail ? hashIdentifier(guestEmail) : null

  // FR-072 lapis 3: pembatasan laju.
  if (await isCommentRateLimited(ipHash, emailHash)) return fail('E-CMT-04')

  // FR-075: balasan dibatasi satu tingkat — balasan dari balasan dinaikkan ke induknya.
  let resolvedParentId: string | null = null
  if (parentId) {
    const parent = await db.comment.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, postId: true },
    })
    if (parent && parent.postId === postId) resolvedParentId = parent.parentId ?? parent.id
  }

  await db.comment.create({
    data: {
      postId,
      body,
      status: 'PENDING', // BRULE-31
      parentId: resolvedParentId,
      authorId: user?.id ?? null,
      guestName: user ? null : guestName,
      guestEmail: user ? null : guestEmail,
      guestEmailHash: emailHash,
      ipHash,
      userAgent: h.get('user-agent')?.slice(0, 255) ?? null,
    },
  })

  return ok({ pending: true })
}

const moderateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  action: z.enum(['approve', 'reject', 'spam', 'delete']),
})

/**
 * FR-074: aksi moderasi.
 * BRULE-29: hanya OWNER yang dapat mengubah status komentar.
 */
export async function moderateComment(input: unknown): Promise<ActionResult<{ affected: number }>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-04')
  }

  const parsed = moderateSchema.safeParse(input)
  if (!parsed.success) return fail('E-SYS-01')
  const { ids, action } = parsed.data

  const affected = await db.comment.findMany({
    where: { id: { in: ids } },
    select: { id: true, post: { select: { slug: true } } },
  })
  if (affected.length === 0) return fail('E-CMT-06')

  if (action === 'delete') {
    // BRULE-33: hapus permanen — tidak dapat dibatalkan.
    await db.comment.deleteMany({ where: { id: { in: ids } } })
  } else {
    const status = { approve: 'APPROVED', reject: 'REJECTED', spam: 'SPAM' }[action] as
      | 'APPROVED'
      | 'REJECTED'
      | 'SPAM'
    await db.comment.updateMany({ where: { id: { in: ids } }, data: { status } })
  }

  await recordAudit(owner.id, `comment.${action}`, 'Comment', ids.join(','), { count: ids.length })

  // Revalidasi halaman artikel terkait agar perubahan tampak ≤ 5 detik (FR-074).
  for (const slug of new Set(affected.map((c) => c.post.slug))) updateTag(tags.post(slug))
  updateTag(tags.postsList)

  return ok({ affected: affected.length })
}

/** FR-075: balasan owner — dibuat langsung APPROVED karena berasal dari owner sendiri. */
export async function replyAsOwner(input: unknown): Promise<ActionResult<void>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-04')
  }

  const schema = z.object({
    postId: z.string().min(1),
    parentId: z.string().min(1),
    body: z.string().trim().min(3).max(3000),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return fail('E-CMT-01')

  const parent = await db.comment.findUnique({
    where: { id: parsed.data.parentId },
    select: { id: true, parentId: true, post: { select: { slug: true } } },
  })
  if (!parent) return fail('E-CMT-06')

  await db.comment.create({
    data: {
      postId: parsed.data.postId,
      parentId: parent.parentId ?? parent.id,
      body: parsed.data.body,
      status: 'APPROVED',
      authorId: owner.id,
    },
  })

  updateTag(tags.post(parent.post.slug))
  return ok(undefined)
}

