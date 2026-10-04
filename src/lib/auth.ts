import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from './db'
import { OWNER_EMAIL, env, isAuthConfigured } from './env'
import { verifyPassword } from './password'
import type { Role } from '@/generated/prisma/enums'

/**
 * Auth.js v5 dengan kredensial — TRD TS-05.
 *
 * Blog ini single-author: hanya satu akun yang boleh masuk, dan kredensialnya
 * berasal dari variabel lingkungan. Tidak ada jalur pendaftaran mandiri sama
 * sekali, sehingga BRULE-01 dijaga oleh konstruksi, bukan oleh pemeriksaan.
 * Pembaca tidak punya akun — mereka berkomentar sebagai tamu (FR-070).
 */

export function resolveRole(email: string | null | undefined): Role {
  if (!email || !OWNER_EMAIL) return 'READER'
  return email.trim().toLowerCase() === OWNER_EMAIL ? 'OWNER' : 'READER'
}

/** BRULE-02: sesi owner berumur pendek. */
const SEVEN_DAYS = 7 * 24 * 60 * 60

/**
 * Hash umpan untuk email yang tidak dikenal. Tanpa ini, permintaan dengan email
 * salah akan kembali jauh lebih cepat daripada yang emailnya benar — selisih
 * waktu itu cukup untuk memastikan alamat owner.
 */
const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Tanpa adapter: sesi berupa JWT, bukan baris basis data. Provider Credentials
  // Auth.js memang tidak mendukung strategi `database`.
  session: { strategy: 'jwt', maxAge: SEVEN_DAYS },
  trustHost: true,
  secret: env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Kata sandi', type: 'password' },
      },
      async authorize(raw) {
        if (!isAuthConfigured) return null

        const email = String(raw?.email ?? '')
          .trim()
          .toLowerCase()
        const password = String(raw?.password ?? '')
        if (!email || !password) return null

        // Email salah tetap menjalankan satu verifikasi agar waktu responsnya
        // setara dengan email benar (E-AUTH-02).
        if (email !== OWNER_EMAIL) {
          await verifyPassword(password, DUMMY_HASH)
          return null
        }
        if (!(await verifyPassword(password, env.OWNER_PASSWORD_HASH))) return null

        // Artikel dan log audit merujuk ke baris User, jadi barisnya dipastikan
        // ada di sini — bukan dibuat lewat pendaftaran.
        const user = await db.user.upsert({
          where: { email },
          create: { email, name: 'Pemilik', role: 'OWNER' },
          update: { role: 'OWNER' },
        })

        return { id: user.id, email: user.email, name: user.name, role: 'OWNER' as Role }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      // `user` hanya terisi pada permintaan masuk; setelah itu token dibaca apa adanya.
      // `sub` dipakai, bukan field buatan sendiri: ia sudah bertipe string di
      // DefaultJWT, sedangkan properti lain jatuh ke indeks `unknown`.
      if (user?.id) token.sub = user.id
      return token
    },

    session({ session, token }) {
      if (session.user) {
        // Id kosong membuat getSessionUser mengembalikan null — gagal sebagai
        // anonim, bukan sebagai pengguna tanpa identitas.
        session.user.id = token.sub ?? ''
        // Peran dihitung ulang dari konfigurasi, bukan dipercaya dari token:
        // mencabut OWNER_EMAIL harus langsung melucuti sesi yang masih berjalan.
        session.user.role = resolveRole(session.user.email)
      }
      return session
    },
  },
})
