import { describe, expect, it } from 'vitest'
import { slugify } from '@/lib/slug'

/**
 * FR-024: normalisasi tag. Tujuannya mencegah tag kembar — masalah yang
 * memicu seluruh pekerjaan penguatan tag ini.
 */
function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Replika dedup di savePost. */
function dedupe(names: string[]): string[] {
  return names.map(normalize).filter((n, i, arr) => n && arr.indexOf(n) === i)
}

describe('normalisasi tag (FR-024)', () => {
  it('menyamakan beda kapitalisasi', () => {
    expect(dedupe(['Keamanan', 'keamanan', 'KEAMANAN'])).toEqual(['keamanan'])
  })
  it('merapikan spasi berlebih', () => {
    expect(normalize('  web   performa  ')).toBe('web performa')
  })
  it('membuang entri kosong', () => {
    expect(dedupe(['catatan', '', '   '])).toEqual(['catatan'])
  })
  it('mempertahankan urutan penulisan', () => {
    expect(dedupe(['b', 'a', 'b'])).toEqual(['b', 'a'])
  })
})

describe('slug tag (BRULE-36)', () => {
  it('nama berbeda bisa menghasilkan slug sama — alasan autocomplete diperlukan', () => {
    // "Next.js" dan "nextjs" sama-sama menjadi "nextjs": tanpa saran tag,
    // penulis tidak sadar sedang memakai ulang atau membuat baru.
    expect(slugify('Next.js')).toBe(slugify('nextjs'))
  })
  it('nama yang mirip bisa menghasilkan slug BERBEDA — inilah sumber tag kembar', () => {
    expect(slugify('next js')).not.toBe(slugify('nextjs'))
  })
  it('slug tag mengikuti aturan yang sama dengan slug artikel', () => {
    expect(slugify('Web Performa!')).toBe('web-performa')
  })
})
