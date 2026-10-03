import { describe, expect, it } from 'vitest'
import { countWords, readingTimeMinutes } from '@/lib/reading-time'

describe('countWords (FR-034)', () => {
  it('menghitung kata biasa', () => {
    expect(countWords('satu dua tiga empat lima')).toBe(5)
  })
  it('tidak menghitung blok kode sebagai prosa', () => {
    const md = 'dua kata\n\n```ts\nconst a = 1\nconst b = 2\nconst c = 3\n```'
    expect(countWords(md)).toBe(2)
  })
  it('mengabaikan sintaks gambar tapi mempertahankan teks tautan', () => {
    expect(countWords('![alt teks](x.png)')).toBe(0)
    expect(countWords('[teks tautan](https://example.com)')).toBe(2)
  })
  it('mengabaikan penanda markdown', () => {
    expect(countWords('## Judul')).toBe(1)
  })
})

describe('readingTimeMinutes (FR-034)', () => {
  it('minimum 1 menit', () => {
    expect(readingTimeMinutes('')).toBe(1)
    expect(readingTimeMinutes('satu kata')).toBe(1)
  })
  it('200 kata = 1 menit', () => {
    expect(readingTimeMinutes('kata '.repeat(200))).toBe(1)
  })
  it('membulatkan ke atas', () => {
    expect(readingTimeMinutes('kata '.repeat(201))).toBe(2)
    expect(readingTimeMinutes('kata '.repeat(450))).toBe(3)
  })
})
