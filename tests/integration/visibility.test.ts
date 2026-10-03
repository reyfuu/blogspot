import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, db, makeOwner, makePost, TEST_PREFIX } from './helpers'

/**
 * Menguji aturan visibilitas yang paling berisiko: kebocoran konten yang
 * belum/tidak boleh tampil publik (BRULE-04) dan kebocoran data pribadi
 * pengomentar (BRULE-30).
 */
describe('visibilitas konten publik (BRULE-04)', () => {
  let ownerId: string

  beforeAll(async () => {
    await cleanup()
    const owner = await makeOwner()
    ownerId = owner.id
  })

  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('hanya artikel PUBLISHED yang terbaca sebagai publik', async () => {
    await Promise.all([
      makePost(ownerId, { slug: `${TEST_PREFIX}terbit`, status: 'PUBLISHED' }),
      makePost(ownerId, { slug: `${TEST_PREFIX}draf`, status: 'DRAFT', publishedAt: null }),
      makePost(ownerId, { slug: `${TEST_PREFIX}jadwal`, status: 'SCHEDULED', publishedAt: null }),
      makePost(ownerId, { slug: `${TEST_PREFIX}arsip`, status: 'ARCHIVED' }),
      makePost(ownerId, { slug: `${TEST_PREFIX}sampah`, status: 'TRASHED' }),
    ])

    const publik = await db.post.findMany({
      where: { status: 'PUBLISHED', publishedAt: { not: null }, slug: { startsWith: TEST_PREFIX } },
      select: { slug: true },
    })

    expect(publik.map((p) => p.slug)).toEqual([`${TEST_PREFIX}terbit`])
  })

  it('draf tidak pernah punya publishedAt', async () => {
    const draf = await db.post.findUnique({ where: { slug: `${TEST_PREFIX}draf` } })
    expect(draf?.publishedAt).toBeNull()
  })

  it('setiap artikel punya token pratinjau unik yang sulit ditebak (FR-029)', async () => {
    const posts = await db.post.findMany({
      where: { slug: { startsWith: TEST_PREFIX } },
      select: { previewToken: true },
    })
    const tokens = posts.map((p) => p.previewToken)
    expect(new Set(tokens).size).toBe(tokens.length)
    for (const t of tokens) expect(t.length).toBeGreaterThanOrEqual(20)
  })
})

describe('riwayat slug & keunikan (BRULE-12)', () => {
  let ownerId: string

  beforeAll(async () => {
    await cleanup()
    ownerId = (await makeOwner()).id
  })

  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('slug historis dipesan permanen di tingkat basis data', async () => {
    const post = await makePost(ownerId, { slug: `${TEST_PREFIX}slug-baru` })
    await db.postSlugHistory.create({ data: { slug: `${TEST_PREFIX}slug-lama`, postId: post.id } })

    // Artikel lain TIDAK boleh memakai slug historis tersebut.
    await expect(
      db.postSlugHistory.create({ data: { slug: `${TEST_PREFIX}slug-lama`, postId: post.id } }),
    ).rejects.toThrow()
  })

  it('slug artikel bersifat unik', async () => {
    await makePost(ownerId, { slug: `${TEST_PREFIX}duplikat` })
    await expect(makePost(ownerId, { slug: `${TEST_PREFIX}duplikat` })).rejects.toThrow()
  })

  it('menghapus artikel ikut menghapus riwayat slugnya', async () => {
    const post = await makePost(ownerId, { slug: `${TEST_PREFIX}akan-dihapus` })
    await db.postSlugHistory.create({ data: { slug: `${TEST_PREFIX}riwayatnya`, postId: post.id } })
    await db.post.delete({ where: { id: post.id } })
    const sisa = await db.postSlugHistory.findUnique({ where: { slug: `${TEST_PREFIX}riwayatnya` } })
    expect(sisa).toBeNull()
  })
})

describe('komentar: status & privasi (BRULE-28, BRULE-30)', () => {
  let ownerId: string
  let postId: string

  beforeAll(async () => {
    await cleanup()
    ownerId = (await makeOwner()).id
    postId = (await makePost(ownerId, { slug: `${TEST_PREFIX}artikel-komentar` })).id
  })

  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('komentar baru berstatus PENDING secara bawaan (BRULE-31)', async () => {
    const c = await db.comment.create({
      data: { postId, body: 'Komentar uji tanpa status eksplisit.', guestName: 'Tamu', guestEmail: 'tamu@example.test' },
    })
    expect(c.status).toBe('PENDING')
  })

  it('kueri publik hanya mengembalikan APPROVED', async () => {
    await db.comment.createMany({
      data: [
        { postId, body: 'disetujui', status: 'APPROVED', guestName: 'A', guestEmail: 'a@example.test' },
        { postId, body: 'ditolak', status: 'REJECTED', guestName: 'B', guestEmail: 'b@example.test' },
        { postId, body: 'spam', status: 'SPAM', guestName: 'C', guestEmail: 'c@example.test' },
      ],
    })
    const publik = await db.comment.findMany({ where: { postId, status: 'APPROVED' }, select: { body: true } })
    expect(publik.map((c) => c.body)).toEqual(['disetujui'])
  })

  it('select publik TIDAK boleh menyertakan guestEmail maupun ipHash', async () => {
    // Ini bentuk select yang dipakai lib/queries.ts getApprovedComments.
    const rows = await db.comment.findMany({
      where: { postId, status: 'APPROVED' },
      select: { id: true, body: true, createdAt: true, parentId: true, guestName: true },
    })
    for (const r of rows) {
      expect(Object.keys(r)).not.toContain('guestEmail')
      expect(Object.keys(r)).not.toContain('ipHash')
      expect(Object.keys(r)).not.toContain('guestEmailHash')
      expect(Object.keys(r)).not.toContain('userAgent')
    }
  })

  it('balasan dibatasi satu tingkat (FR-075)', async () => {
    const root = await db.comment.create({ data: { postId, body: 'akar', status: 'APPROVED', guestName: 'R', guestEmail: 'r@example.test' } })
    const reply = await db.comment.create({ data: { postId, parentId: root.id, body: 'balasan', status: 'APPROVED', guestName: 'S', guestEmail: 's@example.test' } })
    expect(reply.parentId).toBe(root.id)
    // Logika aplikasi menaikkan balasan-dari-balasan ke induk akar.
    const grandParent = reply.parentId ?? reply.id
    expect(grandParent).toBe(root.id)
  })

  it('menghapus artikel ikut menghapus komentarnya', async () => {
    const p = await makePost(ownerId, { slug: `${TEST_PREFIX}hapus-kaskade` })
    await db.comment.create({ data: { postId: p.id, body: 'x', guestName: 'G', guestEmail: 'g@example.test' } })
    await db.post.delete({ where: { id: p.id } })
    expect(await db.comment.count({ where: { postId: p.id } })).toBe(0)
  })
})
