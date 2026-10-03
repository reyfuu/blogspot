import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../../src/lib/markdown'

const attacks: [string, string][] = [
  ['script tag', '<script>alert(1)</script>'],
  ['img onerror', '<img src=x onerror="alert(1)">'],
  ['javascript: href', '[klik](javascript:alert(1))'],
  ['iframe', '<iframe src="https://evil.test"></iframe>'],
  ['svg onload', '<svg onload="alert(1)"></svg>'],
  ['data: uri', '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
  ['style tag', '<style>body{display:none}</style>'],
  ['form', '<form action="https://evil.test"><input name="a"></form>'],
  ['onclick attr', '<p onclick="alert(1)">x</p>'],
]

describe('sanitasi markdown (BRULE-18)', () => {
  for (const [name, payload] of attacks) {
    it(`memblokir ${name}`, async () => {
      const html = await renderMarkdown(payload)
      expect(html).not.toMatch(/<script/i)
      expect(html).not.toMatch(/onerror|onload|onclick/i)
      expect(html).not.toMatch(/javascript:/i)
      expect(html).not.toMatch(/<iframe|<form|<style|<input/i)
      expect(html).not.toMatch(/data:text\/html/i)
    })
  }
  it('H1 diturunkan jadi H2 (FR-030)', async () => {
    const html = await renderMarkdown('# Judul di isi')
    expect(html).not.toMatch(/<h1/i)
    expect(html).toMatch(/<h2/i)
  })
  it('mempertahankan konten sah', async () => {
    const html = await renderMarkdown('**tebal** dan [tautan](https://example.com)')
    expect(html).toMatch(/<strong>tebal<\/strong>/)
    expect(html).toMatch(/href="https:\/\/example\.com"/)
    expect(html).toMatch(/rel="nofollow noopener noreferrer"/)
  })
})
