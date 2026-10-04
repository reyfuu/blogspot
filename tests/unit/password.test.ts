import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

/** TRD TS-05: kata sandi owner disimpan sebagai hash scrypt, tidak pernah mentah. */
describe('hashPassword', () => {
  it('menghasilkan format berisi parameternya sendiri', async () => {
    const hash = await hashPassword('kata-sandi-panjang')
    const [prefix, n, r, p, salt, digest] = hash.split('$')
    expect(prefix).toBe('scrypt')
    expect(Number(n)).toBe(32768)
    expect(Number(r)).toBe(8)
    expect(Number(p)).toBe(1)
    expect(Buffer.from(salt!, 'base64')).toHaveLength(16)
    expect(Buffer.from(digest!, 'base64')).toHaveLength(32)
  })

  it('memakai garam acak — kata sandi sama tidak menghasilkan hash sama', async () => {
    const a = await hashPassword('kata-sandi-panjang')
    const b = await hashPassword('kata-sandi-panjang')
    expect(a).not.toBe(b)
  })

  it('tidak pernah memuat kata sandi mentah', async () => {
    expect(await hashPassword('rahasia-sekali-123')).not.toContain('rahasia-sekali-123')
  })
})

describe('verifyPassword', () => {
  it('menerima kata sandi yang benar', async () => {
    const hash = await hashPassword('kata-sandi-panjang')
    await expect(verifyPassword('kata-sandi-panjang', hash)).resolves.toBe(true)
  })

  it('menolak kata sandi yang salah', async () => {
    const hash = await hashPassword('kata-sandi-panjang')
    await expect(verifyPassword('kata-sandi-panjan', hash)).resolves.toBe(false)
    await expect(verifyPassword('', hash)).resolves.toBe(false)
    await expect(verifyPassword('KATA-SANDI-PANJANG', hash)).resolves.toBe(false)
  })

  it('menyamakan bentuk Unicode, agar sandi sama dari papan ketik berbeda tetap cocok', async () => {
    const terpadu = 'sandi-\u00e9-panjang' // "e" beraksen sebagai satu titik kode
    const terurai = 'sandi-e\u0301-panjang' // "e" + tanda gabung — tampak identik di layar
    expect(terpadu).not.toBe(terurai)

    await expect(verifyPassword(terurai, await hashPassword(terpadu))).resolves.toBe(true)
    await expect(verifyPassword(terpadu, await hashPassword(terurai))).resolves.toBe(true)

    // Huruf yang memang berbeda tetap ditolak.
    await expect(verifyPassword('sandi-e-panjang', await hashPassword(terpadu))).resolves.toBe(false)
  })

  // Hash cacat harus menjadi `false`, bukan lemparan: jalur masuk tidak boleh
  // bisa dibedakan lewat pesan kesalahan.
  it('mengembalikan false untuk hash cacat tanpa melempar', async () => {
    for (const bad of ['', 'bukan-hash', 'scrypt$', 'bcrypt$32768$8$1$AA==$AA==', 'scrypt$x$y$z$AA==$AA==']) {
      await expect(verifyPassword('apa pun', bad)).resolves.toBe(false)
    }
  })

  it('menolak hash yang panjang digestnya tidak cocok', async () => {
    await expect(verifyPassword('apa pun', 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA')).resolves.toBe(false)
  })
})
