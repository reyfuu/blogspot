import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './db'
import { OWNER_EMAILS, env, isGitHubAuthConfigured } from './env'
import type { Role } from '@/generated/prisma/enums'

/**
 * Auth.js v5 — TRD TS-05.
 *
 * Peran OWNER HANYA berasal dari OWNER_EMAILS (BRULE-01). Tidak ada jalur
 * pendaftaran mandiri yang bisa menghasilkan OWNER.
 */

export function resolveRole(email: string | null | undefined): Role {
  if (!email) return 'READER'
  return OWNER_EMAILS.includes(email.toLowerCase()) ? 'OWNER' : 'READER'
}

const SEVEN_DAYS = 7 * 24 * 60 * 60
const THIRTY_DAYS = 30 * 24 * 60 * 60

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: 'database',
    // BRULE-02: sesi diperbarui saat ada aktivitas. Masa berlaku efektif
    // untuk OWNER dipersingkat di callback session di bawah.
    maxAge: THIRTY_DAYS,
    updateAge: 24 * 60 * 60,
  },
  trustHost: true,
  secret: env.AUTH_SECRET,
  providers: isGitHubAuthConfigured
    ? [
        GitHub({
          clientId: env.AUTH_GITHUB_ID,
          clientSecret: env.AUTH_GITHUB_SECRET,
          allowDangerousEmailAccountLinking: false,
        }),
      ]
    : [],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    /** FR-001: tolak bila penyedia tidak memberi email terverifikasi (E-AUTH-03). */
    async signIn({ profile, account }) {
      if (account?.provider === 'github') {
        const email = (profile as { email?: string } | undefined)?.email
        if (!email) return false
      }
      return true
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        // Peran dihitung ulang dari konfigurasi pada setiap sesi, bukan
        // dipercaya dari baris basis data yang mungkin sudah usang.
        session.user.role = resolveRole(user.email)
      }
      // BRULE-02: sesi OWNER lebih pendek daripada READER.
      if (session.user?.role === 'OWNER') {
        const cap = new Date(Date.now() + SEVEN_DAYS * 1000)
        if (session.expires > cap) session.expires = cap as unknown as Date & string
      }
      return session
    },
  },
  events: {
    /** FR-003: tetapkan peran saat pengguna dibuat. */
    async createUser({ user }) {
      const role = resolveRole(user.email)
      if (role === 'OWNER' && user.id) {
        await db.user.update({ where: { id: user.id }, data: { role } })
      }
    },
  },
})
