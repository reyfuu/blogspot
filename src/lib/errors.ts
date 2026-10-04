/**
 * Katalog kesalahan — FRD §12.
 * Pesan ditulis untuk pengguna: menjelaskan apa yang harus dilakukan,
 * tidak pernah membocorkan jejak teknis internal.
 */
export const ERRORS = {
  'E-AUTH-01': 'Sesi Anda telah berakhir. Silakan masuk kembali — tulisan Anda tidak hilang.',
  // BRULE-38: tidak membedakan email salah dari kata sandi salah.
  'E-AUTH-02': 'Email atau kata sandi salah.',
  'E-AUTH-04': 'Anda tidak memiliki akses ke halaman ini.',
  'E-POST-01': 'Lengkapi dulu bagian yang masih kosong.',
  'E-POST-02': 'Ringkasan maksimal 300 karakter.',
  'E-POST-03': 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.',
  'E-POST-04': 'Slug ini sudah digunakan.',
  'E-POST-05': 'Gagal menyimpan — mencoba lagi…',
  'E-POST-06': 'Maksimal 5 tag per artikel.',
  'E-POST-07': 'Waktu penjadwalan harus di masa depan.',
  'E-POST-08': 'Tersimpan, tetapi pembaruan tampilan publik tertunda.',
  'E-MEDIA-01': 'Format berkas tidak didukung. Gunakan JPEG, PNG, WebP, atau AVIF.',
  'E-MEDIA-02': 'Ukuran maksimal 5 MB.',
  'E-MEDIA-03': 'Gagal mengunggah gambar. Coba lagi.',
  'E-CMT-01': 'Komentar harus 3–3.000 karakter.',
  'E-CMT-02': 'Maksimal 3 tautan per komentar.',
  'E-CMT-03': 'Masukkan alamat email yang valid.',
  'E-CMT-04': 'Anda mengirim terlalu banyak komentar. Coba lagi nanti.',
  'E-CMT-05': 'Komentar untuk artikel ini sudah ditutup.',
  'E-CMT-06': 'Komentar ini sudah diproses sebelumnya.',
  'E-SYS-01': 'Terjadi kesalahan. Silakan coba lagi.',
  'E-SYS-02': 'Proses memakan waktu terlalu lama. Hasil parsial tersedia.',
} as const

export type ErrorCode = keyof typeof ERRORS

export class AppError extends Error {
  readonly code: ErrorCode
  readonly details?: string

  constructor(code: ErrorCode, details?: string) {
    super(details ? `${ERRORS[code]} ${details}` : ERRORS[code])
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

/** Bentuk hasil yang dikembalikan Server Action ke komponen form. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fields?: Record<string, string> }

export function fail(code: ErrorCode, extra?: { message?: string; fields?: Record<string, string> }): ActionResult<never> {
  return { ok: false, code, message: extra?.message ?? ERRORS[code], fields: extra?.fields }
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}
