import GithubSlugger from 'github-slugger'

/**
 * Rute yang dipesan sistem — slug artikel tidak boleh bertabrakan dengan ini.
 * FR-023.
 */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'login',
  'logout',
  'search',
  'archive',
  'tag',
  'about',
  'preview',
  'post',
  'rss.xml',
  'sitemap.xml',
  'robots.txt',
  'feed',
  '_next',
])

export const SLUG_MIN = 3
export const SLUG_MAX = 120

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Membentuk slug dari judul: transliterasi, huruf kecil, spasi → tanda hubung,
 * karakter non-alfanumerik dibuang. FR-023.
 */
export function slugify(input: string): string {
  const slugger = new GithubSlugger()
  const base = slugger
    .slug(
      input
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // buang diakritik
        .trim(),
    )
    .replace(/_/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return base.slice(0, SLUG_MAX).replace(/-$/, '')
}

export type SlugValidation =
  | { ok: true }
  | { ok: false; code: 'E-POST-03'; message: string }

/** Validasi format slug sesuai FR-023 dan Lampiran A. */
export function validateSlug(slug: string): SlugValidation {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return {
      ok: false,
      code: 'E-POST-03',
      message: `Slug harus ${SLUG_MIN}–${SLUG_MAX} karakter.`,
    }
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      code: 'E-POST-03',
      message: 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.',
    }
  }
  if (RESERVED_SLUGS.has(slug)) {
    return {
      ok: false,
      code: 'E-POST-03',
      message: `Slug "${slug}" dipesan sistem. Pilih slug lain.`,
    }
  }
  return { ok: true }
}

/**
 * Menambahkan sufiks angka sampai slug unik.
 * `isTaken` memeriksa Post.slug DAN PostSlugHistory.slug — slug historis
 * dipesan permanen (BRULE-12).
 */
export async function makeUniqueSlug(
  desired: string,
  isTaken: (slug: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const base = (slugify(desired) || 'artikel').slice(0, SLUG_MAX - 4)
  let candidate = base
  let n = 1
  while (await isTaken(candidate)) {
    n += 1
    if (n > maxAttempts) {
      candidate = `${base}-${Date.now().toString(36)}`
      break
    }
    candidate = `${base}-${n}`
  }
  return candidate
}
