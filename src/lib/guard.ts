import { auth } from './auth'
import { isAuthConfigured } from './env'
import type { Role } from '@/generated/prisma/enums'

/**
 * Penegakan otorisasi lapis 3 — TRD TS-05 §5.2.
 *
 * Middleware (lapis 1) hanya melindungi navigasi halaman dan BISA dilewati oleh
 * permintaan langsung. Lapisan inilah yang benar-benar menentukan: setiap Server
 * Action dan Route Handler yang bermutasi WAJIB memanggil requireOwner() sebelum
 * efek samping apa pun. Tidak ada pengecualian (FR-002, BR-07).
 */

export class AuthorizationError extends Error {
  readonly code: 'E-AUTH-01' | 'E-AUTH-04'
  readonly status: number

  constructor(code: 'E-AUTH-01' | 'E-AUTH-04') {
    super(
      code === 'E-AUTH-01'
        ? 'Sesi Anda telah berakhir. Silakan masuk kembali — tulisan Anda tidak hilang.'
        : 'Anda tidak memiliki akses ke halaman ini.',
    )
    this.name = 'AuthorizationError'
    this.code = code
    this.status = code === 'E-AUTH-01' ? 401 : 403
  }
}

export type SessionUser = { id: string; email: string; role: Role; name?: string | null }

/** Mengembalikan pengguna sesi, atau null bila anonim. */
export async function getSessionUser(): Promise<SessionUser | null> {
  // Tanpa konfigurasi lengkap tidak ada sesi yang mungkin ada, dan memanggil
  // Auth.js tanpa AUTH_SECRET justru melempar. Anonim adalah jawaban yang benar.
  if (!isAuthConfigured) return null

  const session = await auth()
  const u = session?.user
  if (!u?.id || !u.email) return null
  return { id: u.id, email: u.email, role: u.role ?? 'READER', name: u.name }
}

/**
 * Melempar bila pemanggil bukan OWNER.
 * E-AUTH-01 bila tidak ada sesi (bisa pulih dengan masuk ulang),
 * E-AUTH-04 bila ada sesi tapi bukan owner.
 */
export async function requireOwner(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError('E-AUTH-01')
  if (user.role !== 'OWNER') throw new AuthorizationError('E-AUTH-04')
  return user
}

/** Untuk aksi yang boleh dilakukan pengguna terautentikasi mana pun. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthorizationError('E-AUTH-01')
  return user
}

export async function isOwner(): Promise<boolean> {
  return (await getSessionUser())?.role === 'OWNER'
}
