import { unstable_cache } from 'next/cache'
import { db } from './db'
import { tags } from './cache-tags'
import { DEFAULT_SETTINGS } from './settings'

/**
 * Lapisan akses data untuk JALUR PUBLIK.
 *
 * Dua aturan ditegakkan di sini, bukan diserahkan ke pemanggil:
 *  - BRULE-04: hanya artikel PUBLISHED yang pernah keluar dari modul ini.
 *  - BRULE-30: `select` selalu eksplisit; guestEmail TIDAK PERNAH masuk payload.
 *
 * Fungsi-fungsi ini dibungkus cache bertag (TS-07) sehingga halaman statis
 * tidak menyentuh basis data pada jalur permintaan pembaca (P1).
 */

/**
 * unstable_cache menyerialisasi hasilnya ke JSON, sehingga `Date` kembali
 * sebagai STRING ISO — bukan instance Date. Tanpa pemulihan ini, tipe kita
 * berbohong dan `.toISOString()` meledak saat render.
 *
 * Pemulihan dilakukan di satu tempat (batas cache) agar pemanggil tetap bisa
 * memperlakukan field tanggal sebagai Date.
 */
const DATE_KEYS = new Set(['publishedAt', 'updatedAt', 'createdAt', 'scheduledAt', 'trashedAt'])
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

function reviveDates<T>(value: T): T {
  // Saat cache MISS, unstable_cache mengembalikan nilai hidup dengan Date asli.
  // Tanpa penjagaan ini, Date akan dirusak menjadi objek kosong oleh walker.
  if (value instanceof Date) return value
  if (Array.isArray(value)) return value.map((v) => reviveDates(v)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = DATE_KEYS.has(k) && typeof v === 'string' && ISO.test(v) ? new Date(v) : reviveDates(v)
    }
    return out as T
  }
  return value
}

/** Hanya artikel yang benar-benar tayang. Dipakai setiap kueri publik. */
const publishedWhere = {
  status: 'PUBLISHED' as const,
  publishedAt: { not: null },
}

const postCardSelect = {
  slug: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  readingTime: true,
  cover: { select: { url: true, alt: true, width: true, height: true } },
  tags: { select: { tag: { select: { slug: true, name: true } } } },
} as const

export type PostCard = {
  slug: string
  title: string
  excerpt: string | null
  publishedAt: Date | null
  readingTime: number
  cover: { url: string; alt: string | null; width: number | null; height: number | null } | null
  tags: { slug: string; name: string }[]
}

function toCard(p: {
  slug: string
  title: string
  excerpt: string | null
  publishedAt: Date | null
  readingTime: number
  cover: { url: string; alt: string | null; width: number | null; height: number | null } | null
  tags: { tag: { slug: string; name: string } }[]
}): PostCard {
  return { ...p, tags: p.tags.map((t) => t.tag) }
}

/** FR-050: artikel terbaru untuk beranda. */
const getRecentPostsCached = unstable_cache(
  async (limit = 10): Promise<PostCard[]> => {
    const rows = await db.post.findMany({
      where: publishedWhere,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: postCardSelect,
    })
    return rows.map(toCard)
  },
  ['recent-posts'],
  { tags: [tags.postsList] },
)

/** FR-053: arsip dengan paginasi. BRULE-24: 20/halaman. */
const getPostsPageCached = unstable_cache(
  async (page: number, perPage = DEFAULT_SETTINGS.postsPerPage) => {
    const [total, rows] = await Promise.all([
      db.post.count({ where: publishedWhere }),
      db.post.findMany({
        where: publishedWhere,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: postCardSelect,
      }),
    ])
    return {
      posts: rows.map(toCard),
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    }
  },
  ['posts-page'],
  { tags: [tags.postsList] },
)

/** FR-052: artikel per tag. */
const getPostsByTagCached = unstable_cache(
  async (tagSlug: string, page = 1, perPage = DEFAULT_SETTINGS.postsPerPage) => {
    const tag = await db.tag.findUnique({ where: { slug: tagSlug }, select: { slug: true, name: true } })
    if (!tag) {
      // BRULE-36: slug hasil merge tetap dilayani sebagai pengalihan permanen,
      // agar URL tag yang sudah terindeks tidak mati begitu saja.
      const alias = await db.tagAlias.findUnique({
        where: { slug: tagSlug },
        select: { tag: { select: { slug: true } } },
      })
      return alias ? ({ moved: alias.tag.slug } as const) : null
    }

    const where = { ...publishedWhere, tags: { some: { tag: { slug: tagSlug } } } }
    const [total, rows] = await Promise.all([
      db.post.count({ where }),
      db.post.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: postCardSelect,
      }),
    ])
    // BRULE-09: tag tanpa artikel terbit tidak punya halaman publik.
    if (total === 0) return null
    return { tag, posts: rows.map(toCard), total, totalPages: Math.max(1, Math.ceil(total / perPage)) }
  },
  ['posts-by-tag'],
  { tags: [tags.postsList] },
)

export type PublicPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  publishedAt: Date | null
  updatedAt: Date
  readingTime: number
  wordCount: number
  commentsClosed: boolean
  author: { name: string | null; image: string | null; bio: string | null }
  cover: { url: string; alt: string | null; width: number | null; height: number | null } | null
  tags: { slug: string; name: string }[]
}

const fullPostSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  publishedAt: true,
  updatedAt: true,
  readingTime: true,
  wordCount: true,
  commentsClosed: true,
  author: { select: { name: true, image: true, bio: true } },
  cover: { select: { url: true, alt: true, width: true, height: true } },
  tags: { select: { tag: { select: { slug: true, name: true } } } },
} as const

/**
 * FR-051: satu artikel publik berdasarkan slug.
 * Mengembalikan penanda status agar route dapat memilih 200 / 301 / 410 / 404
 * sesuai TS-04 §4.4 — logika itu TIDAK diduplikasi di halaman.
 */
export type PostLookup =
  | { kind: 'found'; post: PublicPost }
  | { kind: 'moved'; slug: string } // BRULE-12 → 301
  | { kind: 'gone' } // BRULE-13 → 410
  | { kind: 'missing' } // → 404

const lookupPostBySlugCached = unstable_cache(
  async (slug: string): Promise<PostLookup> => {
    const post = await db.post.findUnique({ where: { slug }, select: { ...fullPostSelect, status: true } })

    if (post) {
      if (post.status === 'PUBLISHED') {
        const { status: _status, ...rest } = post
        return { kind: 'found', post: { ...rest, tags: rest.tags.map((t) => t.tag) } }
      }
      // Artikel terarsip memberi sinyal eksplisit ke mesin pencari (BRULE-13).
      if (post.status === 'ARCHIVED') return { kind: 'gone' }
      // DRAFT / SCHEDULED / TRASHED tidak boleh dikonfirmasi keberadaannya.
      return { kind: 'missing' }
    }

    // Slug historis → pengalihan permanen (FR-027, BRULE-12).
    const historical = await db.postSlugHistory.findUnique({
      where: { slug },
      select: { post: { select: { slug: true, status: true } } },
    })
    if (historical?.post.status === 'PUBLISHED') {
      return { kind: 'moved', slug: historical.post.slug }
    }

    return { kind: 'missing' }
  },
  ['post-by-slug'],
  { tags: [tags.postsList] },
)

/** Artikel sebelum/sesudah untuk navigasi di halaman artikel (FR-051). */
const getAdjacentPostsCached = unstable_cache(
  // Argumen fungsi ter-cache ikut diserialisasi, jadi terima ISO string
  // dan ubah ke Date di dalam — bukan menerima Date dari luar.
  async (publishedAtIso: string) => {
    const publishedAt = new Date(publishedAtIso)
    const [prev, next] = await Promise.all([
      db.post.findFirst({
        where: { ...publishedWhere, publishedAt: { lt: publishedAt } },
        orderBy: { publishedAt: 'desc' },
        select: { slug: true, title: true },
      }),
      db.post.findFirst({
        where: { ...publishedWhere, publishedAt: { gt: publishedAt } },
        orderBy: { publishedAt: 'asc' },
        select: { slug: true, title: true },
      }),
    ])
    return { prev, next }
  },
  ['adjacent-posts'],
  { tags: [tags.postsList] },
)

export type PublicComment = {
  id: string
  body: string
  createdAt: Date
  authorName: string
  authorImage: string | null
  isOwner: boolean
  replies: Omit<PublicComment, 'replies'>[]
}

/**
 * FR-070: komentar publik sebuah artikel.
 *
 * Hanya APPROVED yang keluar (BRULE-28). `select` tidak menyertakan guestEmail
 * maupun ipHash — field itu tidak pernah meninggalkan server (BRULE-30).
 */
const getApprovedCommentsCached = unstable_cache(
  async (postId: string): Promise<PublicComment[]> => {
    const rows = await db.comment.findMany({
      where: { postId, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        parentId: true,
        guestName: true,
        author: { select: { name: true, image: true, role: true } },
      },
    })

    const shape = (r: (typeof rows)[number]) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      authorName: r.author?.name ?? r.guestName ?? 'Anonim',
      authorImage: r.author?.image ?? null,
      // FR-075: komentar owner ditandai jelas.
      isOwner: r.author?.role === 'OWNER',
    })

    const roots = rows.filter((r) => !r.parentId)
    return roots.map((r) => ({
      ...shape(r),
      replies: rows.filter((c) => c.parentId === r.id).map(shape),
    }))
  },
  ['approved-comments'],
  { tags: [tags.postsList] },
)

/** FR-062/FR-064: data untuk sitemap dan RSS. */
const getPublishedForFeedsCached = unstable_cache(
  async () => {
    const [posts, tagRows] = await Promise.all([
      db.post.findMany({
        where: publishedWhere,
        orderBy: { publishedAt: 'desc' },
        select: { slug: true, title: true, excerpt: true, publishedAt: true, updatedAt: true, content: true },
      }),
      // BRULE-09: hanya tag yang punya artikel terbit.
      db.tag.findMany({
        where: { posts: { some: { post: publishedWhere } } },
        select: { slug: true },
      }),
    ])
    return { posts, tagSlugs: tagRows.map((t) => t.slug) }
  },
  ['feeds'],
  { tags: [tags.feed, tags.sitemap] },
)

/**
 * FR-054: pencarian. Dinamis — TIDAK di-cache (BRULE-25/26).
 * OQ-7 dijawab dengan pencocokan `contains` sederhana; cukup untuk <500 artikel
 * dan tidak memerlukan indeks full-text.
 */
export async function searchPosts(query: string, limit = 20): Promise<PostCard[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const rows = await db.post.findMany({
    where: {
      ...publishedWhere,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        // FR-054: tag ikut dicari — mencari "keamanan" harus menemukan artikel
        // yang bertag keamanan meski kata itu tidak muncul di judul/isi.
        { tags: { some: { tag: { name: { contains: q, mode: 'insensitive' } } } } },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: postCardSelect,
  })
  return rows.map(toCard)
}

/**
 * Daftar slug untuk generateStaticParams — menopang P1 (static-first).
 * Tanpa ini halaman artikel akan dirender on-demand dan menyentuh basis data
 * pada permintaan pembaca, melanggar BRULE-26.
 */
export const getAllPublishedSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await db.post.findMany({
      where: publishedWhere,
      select: { slug: true },
      orderBy: { publishedAt: 'desc' },
    })
    return rows.map((r) => r.slug)
  },
  ['published-slugs'],
  { tags: [tags.postsList] },
)

/** Tag yang punya artikel terbit (BRULE-09), untuk generateStaticParams. */
export const getAllActiveTagSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await db.tag.findMany({
      where: { posts: { some: { post: publishedWhere } } },
      select: { slug: true },
    })
    return rows.map((r) => r.slug)
  },
  ['active-tag-slugs'],
  { tags: [tags.postsList] },
)

/** Jumlah halaman arsip, untuk prerender paginasi. */
export const getArchivePageCount = unstable_cache(
  async (perPage = DEFAULT_SETTINGS.postsPerPage): Promise<number> => {
    const total = await db.post.count({ where: publishedWhere })
    return Math.max(1, Math.ceil(total / perPage))
  },
  ['archive-page-count'],
  { tags: [tags.postsList] },
)

// ---------- Pembungkus publik: memulihkan Date setelah dibaca dari cache ----------

export async function getRecentPosts(limit = 10): Promise<PostCard[]> {
  return reviveDates(await getRecentPostsCached(limit))
}

export async function getPostsPage(page: number, perPage = DEFAULT_SETTINGS.postsPerPage) {
  return reviveDates(await getPostsPageCached(page, perPage))
}

export async function getPostsByTag(tagSlug: string, page = 1, perPage = DEFAULT_SETTINGS.postsPerPage) {
  return reviveDates(await getPostsByTagCached(tagSlug, page, perPage))
}

export async function lookupPostBySlug(slug: string): Promise<PostLookup> {
  return reviveDates(await lookupPostBySlugCached(slug))
}

export async function getAdjacentPosts(publishedAt: Date) {
  return reviveDates(await getAdjacentPostsCached(publishedAt.toISOString()))
}

export async function getApprovedComments(postId: string): Promise<PublicComment[]> {
  return reviveDates(await getApprovedCommentsCached(postId))
}

export async function getPublishedForFeeds() {
  return reviveDates(await getPublishedForFeedsCached())
}

/**
 * FR-059: seluruh tag beserta jumlah artikel terbit, untuk indeks /tag.
 * BRULE-09: tag tanpa artikel PUBLISHED tidak muncul di halaman publik.
 */
const getAllTagsWithCountCached = unstable_cache(
  async (): Promise<{ slug: string; name: string; count: number }[]> => {
    const rows = await db.tag.findMany({
      where: { posts: { some: { post: publishedWhere } } },
      select: {
        slug: true,
        name: true,
        _count: { select: { posts: { where: { post: publishedWhere } } } },
      },
    })
    return rows
      .map((r) => ({ slug: r.slug, name: r.name, count: r._count.posts }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id'))
  },
  ['all-tags-with-count'],
  { tags: [tags.postsList] },
)

export async function getAllTagsWithCount() {
  return getAllTagsWithCountCached()
}

/**
 * Seluruh tag untuk keperluan admin (autocomplete editor + filter daftar).
 * Tidak di-cache: area admin memang dinamis (BRULE-26), dan daftar ini harus
 * langsung mencerminkan tag yang baru dibuat.
 */
export async function getTagsForAdmin(): Promise<{ id: string; slug: string; name: string; count: number }[]> {
  const rows = await db.tag.findMany({
    select: { id: true, slug: true, name: true, _count: { select: { posts: true } } },
  })
  return rows
    .map((r) => ({ id: r.id, slug: r.slug, name: r.name, count: r._count.posts }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id'))
}
