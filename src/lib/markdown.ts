import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeShiki from '@shikijs/rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { Root } from 'hast'

/**
 * Pipeline render Markdown — TRD TS-06 §6.1.
 *
 * Dijalankan DI SERVER saat halaman diregenerasi, bukan di peramban pembaca:
 * pewarnaan sintaks Shiki tidak menambah satu byte pun JavaScript klien (BRULE-16).
 *
 * Sanitasi memakai daftar-izin (allowlist) dan dijalankan SETELAH semua transformasi,
 * sehingga tidak ada plugin yang bisa menyelundupkan elemen berbahaya (BRULE-18).
 */

/** Daftar elemen yang diizinkan — TRD TS-06 §6.1. */
const ALLOWED_TAGS = [
  'p', 'h2', 'h3', 'h4', 'strong', 'em', 'del', 'ul', 'ol', 'li',
  'blockquote', 'hr', 'a', 'code', 'pre', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'span',
]

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: ALLOWED_TAGS,
  attributes: {
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    code: ['className'],
    pre: ['className', 'style', 'tabIndex'],
    span: ['className', 'style'],
    th: ['colSpan', 'rowSpan', 'align'],
    td: ['colSpan', 'rowSpan', 'align'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    '*': [],
  },
  // Hanya skema aman. Ini yang memblokir javascript: dan data: pada href.
  protocols: {
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
  // `id` sengaja DIKELUARKAN dari daftar clobber: prefix 'user-content-' hanya
  // diterapkan pada id, bukan pada href yang dibuat rehype-autolink-headings,
  // sehingga tautan anchor heading jadi rusak. Id heading berasal dari judul
  // milik owner dan sudah dislugifikasi ke [a-z0-9-], jadi risiko DOM
  // clobbering dapat diabaikan — sementara tautan yang rusak nyata merugikan.
  clobber: ['ariaDescribedBy', 'ariaLabelledBy', 'name'],
  clobberPrefix: 'user-content-',
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
}

/**
 * FR-030: H1 dipesan untuk judul artikel. Heading tingkat 1 di dalam isi
 * diturunkan menjadi H2 agar struktur dokumen (dan SEO) tetap benar.
 * Dinormalisasi diam-diam, bukan ditolak.
 */
function rehypeDemoteH1() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'h1') node.tagName = 'h2'
    })
  }
}

/** FR-033: tautan eksternal diberi atribut keamanan. */
function rehypeExternalLinks() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return
      const href = node.properties?.['href']
      if (typeof href === 'string' && /^https?:\/\//i.test(href)) {
        node.properties = {
          ...node.properties,
          // hast mengharapkan daftar token untuk atribut bernilai banyak.
          rel: ['nofollow', 'noopener', 'noreferrer'],
          target: '_blank',
        }
      }
    })
  }
}

/** FR-043: gambar selalu lazy + async decoding untuk menekan CLS. */
function rehypeImageDefaults() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'img') return
      node.properties = { loading: 'lazy', decoding: 'async', ...node.properties }
    })
  }
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeDemoteH1)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, {
    behavior: 'wrap',
    properties: { className: ['heading-anchor'] },
  })
  .use(rehypeShiki, {
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
    // Bahasa tak dikenal dirender tanpa pewarnaan, bukan melempar galat (FR-031).
    fallbackLanguage: 'text',
  })
  .use(rehypeExternalLinks)
  .use(rehypeImageDefaults)
  // SANITASI TERAKHIR — setelah seluruh transformasi (BRULE-18).
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeStringify)

/** Merender Markdown menjadi HTML yang sudah disanitasi. */
export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await processor.process(markdown)
  return String(file)
}

/**
 * FR-022: ringkasan otomatis dari 160 karakter pertama konten,
 * dipangkas pada batas kata — bukan di tengah kata.
 */
export function deriveExcerpt(markdown: string, max = 160): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Ekstraksi heading untuk daftar isi. Dipakai nanti oleh US-057.
 */
export function extractHeadings(markdown: string): { depth: number; text: string }[] {
  const out: { depth: number; text: string }[] = []
  for (const line of markdown.split('\n')) {
    const m = /^(#{2,4})\s+(.+)$/.exec(line)
    if (m?.[1] && m[2]) out.push({ depth: m[1].length, text: m[2].trim() })
  }
  return out
}
