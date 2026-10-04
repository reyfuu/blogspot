import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

/**
 * Hash kata sandi owner — TRD TS-05.
 *
 * Memakai `scrypt` dari pustaka standar Node, bukan bcrypt/argon2, agar tidak
 * ada modul native yang perlu dikompilasi saat build Vercel. scrypt adalah KDF
 * yang memang dirancang untuk kata sandi: mahal di memori, sehingga serangan
 * dengan GPU tidak banyak menolong.
 */

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>

/** N=32768 menghabiskan ~32 MB per percobaan (128 · N · r). */
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_LENGTH = 32
const SALT_LENGTH = 16
const PREFIX = 'scrypt'

/** Menghasilkan string hash berisi parameternya sendiri, agar bisa diubah kelak. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, PARAMS)
  const { N, r, p } = PARAMS
  return [PREFIX, N, r, p, salt.toString('base64'), derived.toString('base64')].join('$')
}

/**
 * Memverifikasi kata sandi terhadap hash tersimpan.
 * Mengembalikan `false` untuk hash cacat — tidak pernah melempar, agar jalur
 * masuk tidak bisa dibedakan lewat pesan kesalahan.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [prefix, n, r, p, saltB64, hashB64] = stored.split('$')
    if (prefix !== PREFIX || !saltB64 || !hashB64) return false

    const params = { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem }
    if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) return false

    const expected = Buffer.from(hashB64, 'base64')
    const derived = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, params)

    // Panjang harus dibandingkan lebih dulu: timingSafeEqual melempar bila beda.
    return derived.length === expected.length && timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}
