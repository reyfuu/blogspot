/**
 * Tag cache terpusat — TRD TS-07 §7.1.
 * Satu-satunya sumber kebenaran nama tag, agar invalidasi tidak pernah meleset
 * karena salah ketik string di tempat berbeda.
 */
export const tags = {
  post: (slug: string) => `post:${slug}`,
  postsList: 'posts:list',
  tag: (slug: string) => `tag:${slug}`,
  feed: 'feed',
  sitemap: 'sitemap',
  settings: 'settings',
} as const

/** Tag yang di-invalidasi saat status sebuah artikel berubah (TS-07 §7.2). */
export function postMutationTags(slug: string, tagSlugs: readonly string[] = []): string[] {
  return [
    tags.post(slug),
    tags.postsList,
    tags.feed,
    tags.sitemap,
    ...tagSlugs.map((t) => tags.tag(t)),
  ]
}
