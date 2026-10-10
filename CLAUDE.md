# CLAUDE.md

Panduan kerja repo ini ada di **[AGENTS.md](./AGENTS.md)** — baca itu lebih dulu.

@AGENTS.md

---

## Catatan khusus Claude Code

- **Konektor Neon tersedia.** Status basis data, branch, endpoint, dan setelan IP bisa diperiksa langsung lewat MCP Neon — jangan menebak soal Neon sebelum memeriksanya.
- **Konektor Vercel belum terotorisasi.** Deploy dan pembacaan log build tidak bisa dilakukan dari sini; semua yang menyangkut dasbor Vercel harus lewat pengguna.
- **Jalankan perintah lewat Bash** (`cat`, `sed`, `grep`) sesuai mode auto yang aktif, kecuali tugasnya memang butuh alat khusus.
- **`.env` dan `.env.example` diblokir izin** — jangan coba membacanya; mintalah pengguna yang menyunting.

## Status pekerjaan

v1 sudah lengkap dan teruji. Yang tersisa hanyalah **deploy Vercel**, dan hambatannya ada di sisi konfigurasi pengguna, bukan kode:

- `OWNER_EMAIL`, `OWNER_PASSWORD_HASH`, `AUTH_SECRET` perlu diisi di Vercel
- `DATABASE_URL` harus utuh, tanpa tanda kutip, tercentang di semua environment
- `OQ-1` (domain final) dan `OQ-4` (komersial atau tidak) masih terbuka — lihat `docs/README.md`

Build terverifikasi berhasil dari clone bersih dengan variabel ala Vercel.
