'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import { requireOwner } from '@/lib/guard'
import { fail, ok, type ActionResult } from '@/lib/errors'
import { tags } from '@/lib/cache-tags'
import { saveSettings } from '@/lib/settings'
import { recordAudit } from './audit'

const schema = z.object({
  siteName: z.string().trim().min(1).max(100),
  tagline: z.string().trim().max(200),
  description: z.string().trim().max(500),
  authorName: z.string().trim().min(1).max(100),
  authorBio: z.string().trim().max(500),
  commentsEnabled: z.boolean(),
  guestCommentsEnabled: z.boolean(),
  autoCloseCommentsAfterDays: z.number().int().positive().max(3650).nullable(),
  postsPerPage: z.number().int().min(5).max(50),
})

/** FR-083: simpan pengaturan situs. */
export async function updateSettings(input: unknown): Promise<ActionResult<void>> {
  let owner
  try {
    owner = await requireOwner()
  } catch {
    return fail('E-AUTH-04')
  }

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const i of parsed.error.issues) fields[i.path.join('.')] = i.message
    return fail('E-POST-01', { fields })
  }

  await saveSettings(parsed.data)
  await recordAudit(owner.id, 'settings.update', 'Setting', 'site')

  // Perubahan pengaturan memengaruhi seluruh tata letak publik.
  updateTag(tags.settings)
  updateTag(tags.postsList)
  updateTag(tags.feed)
  return ok(undefined)
}
