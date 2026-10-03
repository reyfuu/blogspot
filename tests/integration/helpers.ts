import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@/generated/prisma/client'

export const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env['DATABASE_URL']! }),
})

/** Prefiks agar data uji mudah dibersihkan dan tidak bentrok dengan seed. */
export const TEST_PREFIX = 'zz-uji-'

export async function cleanup() {
  const posts = await db.post.findMany({
    where: { slug: { startsWith: TEST_PREFIX } },
    select: { id: true },
  })
  const ids = posts.map((p) => p.id)
  if (ids.length > 0) {
    await db.comment.deleteMany({ where: { postId: { in: ids } } })
    await db.postSlugHistory.deleteMany({ where: { postId: { in: ids } } })
    await db.postTag.deleteMany({ where: { postId: { in: ids } } })
    await db.post.deleteMany({ where: { id: { in: ids } } })
  }
  await db.postSlugHistory.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } })
  await db.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } })
  await db.tag.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } })
}

export async function makeOwner() {
  return db.user.upsert({
    where: { email: `${TEST_PREFIX}owner@example.test` },
    create: { email: `${TEST_PREFIX}owner@example.test`, name: 'Owner Uji', role: 'OWNER' },
    update: {},
  })
}

export async function makePost(
  authorId: string,
  overrides: Partial<{
    slug: string
    title: string
    content: string
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'TRASHED'
    publishedAt: Date | null
  }> = {},
) {
  const slug = overrides.slug ?? `${TEST_PREFIX}${Math.random().toString(36).slice(2, 10)}`
  return db.post.create({
    data: {
      slug,
      title: overrides.title ?? 'Artikel Uji',
      content: overrides.content ?? 'Isi artikel uji.',
      status: overrides.status ?? 'PUBLISHED',
      publishedAt: overrides.publishedAt ?? (overrides.status ?? 'PUBLISHED') === 'PUBLISHED' ? new Date() : null,
      authorId,
    },
  })
}
