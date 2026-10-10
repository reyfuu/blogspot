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
export async function bacaUntukPrerender<T>(rute: string, baca: () => Promise<T>): Promise<T> {
  try {
    return await baca()
  } catch (penyebab) {
    const detail = penyebab instanceof Error ? penyebab.message : String(penyebab)
    throw new Error(
      [
        `[E-DB-01] Gagal membaca basis data saat memprerender ${rute}.`,
        '',
        `  Penyebab asli: ${detail}`,
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
