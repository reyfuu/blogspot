import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS, makeUniqueSlug, slugify, validateSlug } from '@/lib/slug'

describe('slugify (FR-023)', () => {
  it('mengubah judul menjadi slug yang rapi', () => {
    expect(slugify('Menulis Lagi, Kali Ini di Rumah Sendiri')).toBe('menulis-lagi-kali-ini-di-rumah-sendiri')
  })
  it('membuang karakter non-alfanumerik', () => {
    expect(slugify('Hello! @World# $2026%')).toBe('hello-world-2026')
  })
  it('menormalkan diakritik', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu')
  })
  it('tidak menyisakan tanda hubung di ujung', () => {
    const s = slugify('--- judul ---')
    expect(s.startsWith('-')).toBe(false)
    expect(s.endsWith('-')).toBe(false)
  })
  it('menggabungkan tanda hubung berulang', () => {
    expect(slugify('a    b')).not.toContain('--')
  })
  it('memangkas pada panjang maksimum', () => {
    expect(slugify('x'.repeat(300)).length).toBeLessThanOrEqual(120)
  })
})

describe('validateSlug (FR-023)', () => {
  it('menerima slug yang sah', () => {
    expect(validateSlug('catatan-tentang-kecepatan').ok).toBe(true)
  })
  it('menolak huruf besar', () => {
    const r = validateSlug('Judul-Artikel')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('E-POST-03')
  })
  it('menolak terlalu pendek', () => {
    expect(validateSlug('ab').ok).toBe(false)
  })
  it('menolak terlalu panjang', () => {
    expect(validateSlug('a'.repeat(121)).ok).toBe(false)
  })
  it('menolak spasi dan garis bawah', () => {
    expect(validateSlug('dua kata').ok).toBe(false)
    expect(validateSlug('dua_kata').ok).toBe(false)
  })
  it('menolak tanda hubung di ujung', () => {
    expect(validateSlug('-awal').ok).toBe(false)
    expect(validateSlug('akhir-').ok).toBe(false)
  })

  // FR-023: slug tidak boleh bertabrakan dengan rute sistem.
  for (const reserved of ['admin', 'api', 'login', 'search', 'archive', 'tag', 'about', 'preview']) {
    it(`menolak rute terlarang "${reserved}"`, () => {
      expect(validateSlug(reserved).ok).toBe(false)
    })
  }
  it('daftar terlarang mencakup berkas SEO', () => {
    expect(RESERVED_SLUGS.has('sitemap.xml')).toBe(true)
    expect(RESERVED_SLUGS.has('robots.txt')).toBe(true)
    expect(RESERVED_SLUGS.has('rss.xml')).toBe(true)
  })
})

describe('makeUniqueSlug (FR-023, BRULE-12)', () => {
  it('mengembalikan slug asli bila belum dipakai', async () => {
    expect(await makeUniqueSlug('judul-baru', async () => false)).toBe('judul-baru')
  })
  it('menambahkan sufiks angka saat bentrok', async () => {
    const taken = new Set(['judul', 'judul-2'])
    expect(await makeUniqueSlug('judul', async (s) => taken.has(s))).toBe('judul-3')
  })
  it('tidak menggantung bila semua kandidat terpakai', async () => {
    const result = await makeUniqueSlug('judul', async () => true, 5)
    expect(result).toMatch(/^judul-/)
    expect(result.length).toBeGreaterThan('judul-'.length)
  })
  it('memberi nama cadangan untuk judul kosong', async () => {
    expect(await makeUniqueSlug('', async () => false)).toBe('artikel')
  })
})
