'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/guard'
import { AppError, fail, ok, type ActionResult } from '@/lib/errors'
import { postMutationTags, tags } from '@/lib/cache-tags'
import { makeUniqueSlug, slugify, validateSlug } from '@/lib/slug'
import { countWords, readingTimeMinutes } from '@/lib/reading-time'
import { deriveExcerpt } from '@/lib/markdown'
import { recordAudit } from './audit'

/**
 * Server Actions artikel — FR-020…FR-029.
 *
 * POLA WAJIB di setiap action (TS-05 §5.2 lapis 3):
 *   1. await requireOwner()   ← sebelum efek samping apa pun
 *   2. validasi Zod
 *   3. mutasi
 *   4. revalidateTag
 */

const MAX_CONTENT = 200_000 // Lampiran A

async function slugTaken(slug: string, exceptPostId?: string): Promise<boolean> {
  const [post, historical] = await Promise.all([
    db.post.findUnique({ where: { slug }, select: { id: true } }),
    db.postSlugHistory.findUnique({ where: { slug }, select: { postId: true } }),
  ])
  if (post && post.id !== exceptPostId) return true
  // BRULE-12: slug historis dipesan permanen, termasuk milik artikel lain.
  if (historical && historical.postId !== exceptPostId) return true
  return false
}

/** FR-020: buat artikel kosong, langsung siap diketik. */
export async function createPost(): Promise<never> {
  const owner = await requireOwner()

  const slug = await makeUniqueSlug('tanpa-judul', (s) => slugTaken(s))
  const post = await db.post.create({
    data: {
      title: 'Tanpa judul',
      slug,
      content: '',
      status: 'DRAFT',
      authorId: owner.id,
    },
    select: { id: true },
  })

  await recordAudit(owner.id, 'post.create', 'Post', post.id)
  redirect(`/admin/posts/${post.id}`)
}

const autosaveSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200).optional(),
  content: z.string().max(MAX_CONTENT).optional(),
})

/**
 * FR-021: autosave.
 * BRULE-07: TIDAK PERNAH mengubah status. Artikel PUBLISHED yang disunting
 * tetap PUBLISHED, dan perubahannya baru tampil publik setelah savePost().
 */
export async function autosavePost(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  try {
    await requireOwner()
    const parsed = autosaveSchema.safeParse(input)
    if (!parsed.success) return fail('E-POST-05')

    const { id, title, content } = parsed.data
    await db.post.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined
          ? { content, wordCount: countWords(content), readingTime: readingTimeMinutes(content) }
          : {}),
      },
    })
    return ok({ savedAt: new Date().toISOString() })
  } catch {
    return fail('E-POST-05')
  }
}

const metaSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200),
  slug: z.string().trim().min(3).max(120),
  excerpt: z.string().trim().max(300).optional().or(z.literal('')),
  content: z.string().max(MAX_CONTENT),
  tagNames: z.array(z.string().trim().min(2).max(30)).max(5, 'Maksimal 5 tag per artikel'),
  coverId: z.string().optional().or(z.literal('')),
  commentsClosed: z.boolean().optional(),
})

/** FR-022/023/024/026: simpan metadata + konten secara eksplisit. */
export async function savePost(input: unknown): Promise<ActionResult<{ slug: string }>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-01')
  }

  const parsed = metaSchema.safeParse(input)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (key && !fields[key]) fields[key] = issue.message
    }
    const tagIssue = parsed.error.issues.find((i) => i.path[0] === 'tagNames')
    return fail(tagIssue ? 'E-POST-06' : 'E-POST-01', { fields })
  }

  const { id, title, slug: rawSlug, excerpt, content, tagNames, coverId, commentsClosed } = parsed.data

  const existing = await db.post.findUnique({
    where: { id },
    select: { slug: true, status: true, publishedAt: true, tags: { select: { tag: { select: { slug: true } } } } },
  })
  if (!existing) return fail('E-SYS-01')

  const desiredSlug = slugify(rawSlug)
  const slugCheck = validateSlug(desiredSlug)
  if (!slugCheck.ok) return fail('E-POST-03', { message: slugCheck.message, fields: { slug: slugCheck.message } })

  if (desiredSlug !== existing.slug && (await slugTaken(desiredSlug, id))) {
    const suggestion = await makeUniqueSlug(desiredSlug, (s) => slugTaken(s, id))
    return fail('E-POST-04', {
      message: `Slug "${desiredSlug}" sudah digunakan. Coba: ${suggestion}`,
      fields: { slug: `Sudah digunakan. Saran: ${suggestion}` },
    })
  }

  // BRULE-08: perubahan slug pasca-terbit wajib mencatat riwayat + redirect 301.
  const hasBeenPublished = existing.publishedAt !== null
  const slugChanged = desiredSlug !== existing.slug

  const tagRecords = await Promise.all(
    tagNames
      .map((n) => n.trim().toLowerCase())
      .filter((n, i, arr) => n && arr.indexOf(n) === i) // duplikat digabungkan (FR-024)
      .map((name) =>
        db.tag.upsert({
          where: { slug: slugify(name) },
          create: { slug: slugify(name), name },
          update: {},
          select: { id: true, slug: true },
        }),
      ),
  )

  await db.$transaction(async (tx) => {
    if (slugChanged && hasBeenPublished) {
      await tx.postSlugHistory.create({ data: { slug: existing.slug, postId: id } })
    }
    await tx.postTag.deleteMany({ where: { postId: id } })
    await tx.post.update({
      where: { id },
      data: {
        title,
        slug: desiredSlug,
        excerpt: excerpt ? excerpt : deriveExcerpt(content),
        content,
        wordCount: countWords(content),
        readingTime: readingTimeMinutes(content),
        coverId: coverId ? coverId : null,
        ...(commentsClosed !== undefined ? { commentsClosed } : {}),
        tags: { create: tagRecords.map((t) => ({ tagId: t.id })) },
      },
    })
  })

  await recordAudit(owner.id, slugChanged ? 'post.slug_change' : 'post.update', 'Post', id, {
    from: existing.slug,
    to: desiredSlug,
  })

  // BRULE-11: menyunting tidak mengubah publishedAt → urutan kronologis aman.
  const affected = [
    ...postMutationTags(desiredSlug, [
      ...tagRecords.map((t) => t.slug),
      ...existing.tags.map((t) => t.tag.slug),
    ]),
    ...(slugChanged ? [tags.post(existing.slug)] : []),
  ]
  for (const t of new Set(affected)) updateTag(t)

  return ok({ slug: desiredSlug })
}

const publishSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(['now', 'schedule']),
  scheduledAt: z.string().datetime().optional(),
})

/** FR-025: terbitkan sekarang atau jadwalkan. */
export async function publishPost(input: unknown): Promise<ActionResult<{ status: string }>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-01')
  }

  const parsed = publishSchema.safeParse(input)
  if (!parsed.success) return fail('E-SYS-01')
  const { id, mode, scheduledAt } = parsed.data

  const post = await db.post.findUnique({
    where: { id },
    select: {
      slug: true,
      title: true,
      content: true,
      publishedAt: true,
      tags: { select: { tag: { select: { slug: true } } } },
    },
  })
  if (!post) return fail('E-SYS-01')

  // Prasyarat terbit (FR-025 / E-POST-01).
  const missing: string[] = []
  if (!post.title.trim() || post.title === 'Tanpa judul') missing.push('judul')
  if (!post.content.trim()) missing.push('isi artikel')
  // BRULE-17: teks alternatif wajib sebelum terbit.
  const imagesWithoutAlt = [...post.content.matchAll(/!\[(.*?)\]\(/g)].filter((m) => !m[1]?.trim())
  if (imagesWithoutAlt.length > 0) missing.push(`teks alternatif untuk ${imagesWithoutAlt.length} gambar`)
  if (missing.length > 0) {
    return fail('E-POST-01', { message: `Lengkapi dulu: ${missing.join(', ')}.` })
  }

  if (mode === 'schedule') {
    if (!scheduledAt) return fail('E-POST-07')
    const when = new Date(scheduledAt)
    if (when.getTime() <= Date.now()) return fail('E-POST-07')
    await db.post.update({ where: { id }, data: { status: 'SCHEDULED', scheduledAt: when } })
    await recordAudit(owner.id, 'post.schedule', 'Post', id, { scheduledAt: when.toISOString() })
  } else {
    await db.post.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        // BRULE-11: publishedAt hanya diisi sekali, saat pertama terbit.
        publishedAt: post.publishedAt ?? new Date(),
        scheduledAt: null,
      },
    })
    await recordAudit(owner.id, 'post.publish', 'Post', id)
  }

  for (const t of new Set(postMutationTags(post.slug, post.tags.map((x) => x.tag.slug)))) updateTag(t)
  return ok({ status: mode === 'schedule' ? 'SCHEDULED' : 'PUBLISHED' })
}

const idSchema = z.object({ id: z.string().min(1) })

/** Transisi status lain: tarik kembali, arsipkan, hapus, pulihkan (FR-028). */
async function transition(
  input: unknown,
  next: 'DRAFT' | 'ARCHIVED' | 'TRASHED',
  action: string,
): Promise<ActionResult<void>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-01')
  }
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return fail('E-SYS-01')

  const post = await db.post.findUnique({
    where: { id: parsed.data.id },
    select: { slug: true, tags: { select: { tag: { select: { slug: true } } } } },
  })
  if (!post) return fail('E-SYS-01')

  await db.post.update({
    where: { id: parsed.data.id },
    data: {
      status: next,
      // BRULE-05: hapus lunak mencatat waktu untuk retensi 30 hari.
      trashedAt: next === 'TRASHED' ? new Date() : null,
    },
  })

  await recordAudit(owner.id, action, 'Post', parsed.data.id)
  for (const t of new Set(postMutationTags(post.slug, post.tags.map((x) => x.tag.slug)))) updateTag(t)
  return ok(undefined)
}

// Modul 'use server' hanya boleh mengekspor fungsi async — bukan arrow const.
export async function unpublishPost(input: unknown): Promise<ActionResult<void>> {
  return transition(input, 'DRAFT', 'post.unpublish')
}

export async function archivePost(input: unknown): Promise<ActionResult<void>> {
  return transition(input, 'ARCHIVED', 'post.archive')
}

export async function trashPost(input: unknown): Promise<ActionResult<void>> {
  return transition(input, 'TRASHED', 'post.trash')
}

export async function restorePost(input: unknown): Promise<ActionResult<void>> {
  return transition(input, 'DRAFT', 'post.restore')
}

/** FR-029: cabut dan buat ulang token pratinjau. */
export async function rotatePreviewToken(input: unknown): Promise<ActionResult<{ token: string }>> {
  try {
    const owner = await requireOwner()
    const parsed = idSchema.safeParse(input)
    if (!parsed.success) return fail('E-SYS-01')

    const { randomUUID } = await import('node:crypto')
    const token = randomUUID()
    await db.post.update({ where: { id: parsed.data.id }, data: { previewToken: token } })
    await recordAudit(owner.id, 'post.rotate_preview_token', 'Post', parsed.data.id)
    return ok({ token })
  } catch (e) {
    return fail(e instanceof AppError ? e.code : 'E-AUTH-01')
  }
}
