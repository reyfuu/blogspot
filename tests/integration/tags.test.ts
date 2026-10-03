import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, db, makeOwner, makePost, TEST_PREFIX } from './helpers'

/**
 * Menguji operasi tag yang paling mudah merusak data atau SEO:
 * merge (PK gabungan + alias 301) dan hapus (kehilangan kategori diam-diam).
 */

async function makeTag(name: string) {
  const slug = `${TEST_PREFIX}${name}`
  return db.tag.upsert({ where: { slug }, create: { slug, name: slug }, update: {}, select: { id: true, slug: true } })
}

describe('penggabungan tag (FR-084, BRULE-36, BRULE-37)', () => {
  let ownerId: string

  beforeEach(async () => {
    await cleanup()
    await db.tagAlias.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } })
    ownerId = (await makeOwner()).id
  })

  afterAll(async () => {
    await cleanup()
    await db.tagAlias.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } })
    await db.$disconnect()
  })

  /** Replika logika transaksi mergeTags, diuji terhadap basis data nyata. */
  async function merge(fromId: string, intoId: string, fromSlug: string) {
    return db.$transaction(async (tx) => {
      const fromLinks = await tx.postTag.findMany({ where: { tagId: fromId }, select: { postId: true } })
      const intoLinks = await tx.postTag.findMany({ where: { tagId: intoId }, select: { postId: true } })
      const already = new Set(intoLinks.map((l) => l.postId))
      const toMove = fromLinks.filter((l) => !already.has(l.postId)).map((l) => l.postId)

      await tx.postTag.deleteMany({ where: { tagId: fromId } })
      if (toMove.length > 0) {
        await tx.postTag.createMany({ data: toMove.map((postId) => ({ postId, tagId: intoId })) })
      }
      await tx.tagAlias.upsert({
        where: { slug: fromSlug },
        create: { slug: fromSlug, tagId: intoId },
        update: { tagId: intoId },
      })
      await tx.tag.delete({ where: { id: fromId } })
      return toMove.length
    })
  }

  it('memindahkan artikel dari tag sumber ke tag tujuan', async () => {
    const [from, into] = [await makeTag('lama'), await makeTag('baru')]
    const post = await makePost(ownerId, { slug: `${TEST_PREFIX}a` })
    await db.postTag.create({ data: { postId: post.id, tagId: from.id } })

    const moved = await merge(from.id, into.id, from.slug)

    expect(moved).toBe(1)
    const links = await db.postTag.findMany({ where: { postId: post.id }, select: { tagId: true } })
    expect(links.map((l) => l.tagId)).toEqual([into.id])
  })

  it('TIDAK menduplikasi relasi saat artikel punya kedua tag (BRULE-37)', async () => {
    const [from, into] = [await makeTag('lama'), await makeTag('baru')]
    const post = await makePost(ownerId, { slug: `${TEST_PREFIX}b` })
    // Artikel sengaja diberi KEDUA tag — inilah kasus yang melanggar PK gabungan.
    await db.postTag.createMany({
      data: [
        { postId: post.id, tagId: from.id },
        { postId: post.id, tagId: into.id },
      ],
    })

    const moved = await merge(from.id, into.id, from.slug)

    expect(moved).toBe(0)
    const links = await db.postTag.findMany({ where: { postId: post.id } })
    expect(links).toHaveLength(1)
    expect(links[0]?.tagId).toBe(into.id)
  })

  it('meninggalkan alias agar slug lama dapat dialihkan 301 (BRULE-36)', async () => {
    const [from, into] = [await makeTag('lama'), await makeTag('baru')]
    await merge(from.id, into.id, from.slug)

    const alias = await db.tagAlias.findUnique({
      where: { slug: from.slug },
      select: { tag: { select: { slug: true } } },
    })
    expect(alias?.tag.slug).toBe(into.slug)
  })

  it('tag sumber benar-benar hilang setelah digabung', async () => {
    const [from, into] = [await makeTag('lama'), await makeTag('baru')]
    await merge(from.id, into.id, from.slug)
    expect(await db.tag.findUnique({ where: { id: from.id } })).toBeNull()
  })

  it('alias ikut terhapus bila tag tujuan dihapus (cascade)', async () => {
    const [from, into] = [await makeTag('lama'), await makeTag('baru')]
    await merge(from.id, into.id, from.slug)
    await db.tag.delete({ where: { id: into.id } })
    expect(await db.tagAlias.findUnique({ where: { slug: from.slug } })).toBeNull()
  })

  it('slug alias unik — tidak bisa dipakai dua tag berbeda', async () => {
    const [a, b, into] = [await makeTag('x'), await makeTag('y'), await makeTag('tujuan')]
    await merge(a.id, into.id, a.slug)
    // Mencoba mendaftarkan slug alias yang sama untuk tag lain harus gagal.
    await expect(db.tagAlias.create({ data: { slug: a.slug, tagId: b.id } })).rejects.toThrow()
  })
})

describe('pencarian mencakup tag (FR-054)', () => {
  let ownerId: string

  beforeEach(async () => {
    await cleanup()
    ownerId = (await makeOwner()).id
  })

  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('menemukan artikel lewat nama tag meski kata itu tidak ada di judul/isi', async () => {
    const tag = await db.tag.upsert({
      where: { slug: `${TEST_PREFIX}kriptografi` },
      create: { slug: `${TEST_PREFIX}kriptografi`, name: `${TEST_PREFIX}kriptografi` },
      update: {},
    })
    const post = await makePost(ownerId, {
      slug: `${TEST_PREFIX}tanpa-kata-itu`,
      title: 'Judul biasa',
      content: 'Isi tanpa kata kunci tersebut.',
    })
    await db.postTag.create({ data: { postId: post.id, tagId: tag.id } })

    const q = 'kriptografi'
    const found = await db.post.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { not: null },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
          { tags: { some: { tag: { name: { contains: q, mode: 'insensitive' } } } } },
        ],
      },
      select: { slug: true },
    })

    expect(found.map((p) => p.slug)).toContain(`${TEST_PREFIX}tanpa-kata-itu`)
  })
})
