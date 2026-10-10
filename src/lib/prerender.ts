/**
 * Pembacaan basis data pada tahap build.
 *
 * Prinsip static-first (TRD TS-01 P1) membuat halaman publik diprerender, jadi
 * `DATABASE_URL` harus bisa dihubungi pada tahap **Build**, bukan hanya saat
 * runtime. Bila tidak, Next merangkum kegagalan apa pun menjadi satu baris —
 * "Failed to collect page data for <rute>" — tanpa menyebut penyebabnya.
 * Pesan seperti itu tidak bisa dipakai untuk memperbaiki apa pun.
 *
 * Lapisan ini mengembalikan penyebab aslinya ke permukaan log build.
 */
/**
 * Menggambarkan DATABASE_URL tanpa membocorkan kata sandinya.
 *
 * Nilai yang salah tempel — terbungkus kutip, terpotong, atau berspasi di ujung —
 * menghasilkan kegagalan yang tampak sama persis dengan basis data yang mati.
 * Menyebut host yang benar-benar dicoba membuat keduanya langsung terbedakan.
 */
function gambarkanDatabaseUrl(): string {
  const mentah = process.env['DATABASE_URL']
  if (!mentah) return 'DATABASE_URL tidak terbaca sama sekali'

  const rapi = mentah.trim()
  const catatan: string[] = []
  if (rapi !== mentah) catatan.push('ADA SPASI/BARIS BARU DI UJUNG')
  if (/^['"]|['"]$/.test(rapi)) catatan.push('TERBUNGKUS TANDA KUTIP — hapus kutipnya')

  try {
    const url = new URL(rapi.replace(/^['"]|['"]$/g, ''))
    catatan.unshift(`host "${url.hostname}"`)
  } catch {
    catatan.unshift('BUKAN URL YANG SAH')
  }
  return catatan.join(' · ')
}

export async function bacaUntukPrerender<T>(rute: string, baca: () => Promise<T>): Promise<T> {
  try {
    return await baca()
  } catch (penyebab) {
    const detail = penyebab instanceof Error ? penyebab.message : String(penyebab)
    throw new Error(
      [
        `[E-DB-01] Gagal membaca basis data saat memprerender ${rute}.`,
        '',
        `  Penyebab asli: ${detail || '(kosong — soket gagal dibuka, bukan kueri yang ditolak)'}`,
        `  DATABASE_URL terbaca: ${gambarkanDatabaseUrl()}`,
        '',
        '  Halaman publik diprerender saat build, jadi DATABASE_URL harus bisa',
        '  dihubungi pada tahap Build — bukan hanya saat runtime. Periksa:',
        '    1. DATABASE_URL terisi, dan tercentang untuk environment yang sedang dibangun',
        '       (Production / Preview / Development punya centang sendiri-sendiri).',
        '    2. Nilainya memakai host ber-"-pooler" dan diakhiri "?sslmode=require".',
        '    3. Basis datanya masih ada dan tidak diblokir daftar IP.',
      ].join('\n'),
      { cause: penyebab },
    )
  }
}
