import type { Role } from '@/generated/prisma/enums'
import type { DefaultSession } from 'next-auth'

// Catatan: interface JWT dideklarasikan di `@auth/core/jwt`, bukan di
// `next-auth/jwt` yang hanya me-re-export. Mengaugmentasi `next-auth/jwt` di
// sini tidak berpengaruh apa-apa, jadi id pengguna dibawa lewat `sub` bawaan
// yang sudah bertipe string. Lihat callbacks di src/lib/auth.ts.
declare module 'next-auth' {
  interface Session {
    user: { id: string; role: Role } & DefaultSession['user']
  }
  interface User {
    role?: Role
  }
}
