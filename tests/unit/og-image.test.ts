import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_COVER_BYTES, loadImageAsDataUri, resolveCoverUrl } from '@/lib/og-image'

const SITE = 'https://blog.example.com'

describe('resolveCoverUrl (FR-061)', () => {
  it('membiarkan URL absolut http/https apa adanya', () => {
    expect(resolveCoverUrl('https://blob.example.com/a.png', SITE)).toBe('https://blob.example.com/a.png')
    expect(resolveCoverUrl('http://blob.example.com/a.png', SITE)).toBe('http://blob.example.com/a.png')
  })
  it('menjadikan jalur absolut relatif terhadap situs', () => {
    expect(resolveCoverUrl('/uploads/a.png', SITE)).toBe('https://blog.example.com/uploads/a.png')
  })
  it('tidak menggandakan garis miring saat siteUrl berakhiran /', () => {
    expect(resolveCoverUrl('/a.png', 'https://blog.example.com/')).toBe('https://blog.example.com/a.png')
  })
  it('menolak skema selain http/https agar build tidak membaca berkas lokal', () => {
    expect(resolveCoverUrl('file:///etc/passwd', SITE)).toBeNull()
    expect(resolveCoverUrl('data:image/png;base64,AAAA', SITE)).toBeNull()
  })
  it('menolak nilai kosong dan jalur relatif yang ambigu', () => {
    expect(resolveCoverUrl('', SITE)).toBeNull()
    expect(resolveCoverUrl('   ', SITE)).toBeNull()
    expect(resolveCoverUrl('a.png', SITE)).toBeNull()
  })
})

/** Respons gambar palsu dengan bytes dan content-type yang dapat diatur. */
function imageResponse(bytes: Uint8Array, contentType = 'image/png', status = 200): Response {
  return new Response(bytes as unknown as BodyInit, { status, headers: { 'content-type': contentType } })
}

function mockFetch(impl: () => Response | Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => impl())
}

afterEach(() => vi.restoreAllMocks())

describe('loadImageAsDataUri (FR-061 / E-SEO-01)', () => {
  it('mengembalikan data URI untuk gambar yang valid', async () => {
    mockFetch(() => imageResponse(new Uint8Array([1, 2, 3, 4])))
    const uri = await loadImageAsDataUri('/a.png', SITE)
    expect(uri).toBe(`data:image/png;base64,${Buffer.from([1, 2, 3, 4]).toString('base64')}`)
  })

  it('membuang parameter content-type seperti charset', async () => {
    mockFetch(() => imageResponse(new Uint8Array([1]), 'image/jpeg; charset=binary'))
    await expect(loadImageAsDataUri('/a.jpg', SITE)).resolves.toMatch(/^data:image\/jpeg;base64,/)
  })

  // E-SEO-01: setiap kegagalan harus menjadi null, bukan lemparan.
  it('mengembalikan null saat status bukan 2xx', async () => {
    mockFetch(() => imageResponse(new Uint8Array([1]), 'image/png', 404))
    await expect(loadImageAsDataUri('/a.png', SITE)).resolves.toBeNull()
  })

  it('mengembalikan null saat jawaban bukan gambar', async () => {
    mockFetch(() => imageResponse(new Uint8Array([1]), 'text/html'))
    await expect(loadImageAsDataUri('/a.png', SITE)).resolves.toBeNull()
  })

  it('mengembalikan null saat jawaban kosong', async () => {
    mockFetch(() => imageResponse(new Uint8Array()))
    await expect(loadImageAsDataUri('/a.png', SITE)).resolves.toBeNull()
  })

  it('mengembalikan null saat berkas melebihi batas ukuran', async () => {
    mockFetch(() => imageResponse(new Uint8Array(MAX_COVER_BYTES + 1)))
    await expect(loadImageAsDataUri('/a.png', SITE)).resolves.toBeNull()
  })

  it('mengembalikan null saat pengambilan melempar (jaringan mati / waktu habis)', async () => {
    mockFetch(() => {
      throw new Error('ECONNREFUSED')
    })
    await expect(loadImageAsDataUri('/a.png', SITE)).resolves.toBeNull()
  })

  it('tidak mengambil apa pun bila URL ditolak', async () => {
    const spy = mockFetch(() => imageResponse(new Uint8Array([1])))
    await expect(loadImageAsDataUri('file:///etc/passwd', SITE)).resolves.toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})
