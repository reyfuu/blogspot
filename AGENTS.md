# AGENTS.md — Panduan kerja untuk agen di repo ini

Blog pribadi **single-author**, Bahasa Indonesia, dideploy di Vercel.
Dokumen perencanaan lengkap ada di [`docs/`](./docs/) — BRD → PRD → FRD → TRD.
Panduan penyiapan: [`docs/SETUP.md`](./docs/SETUP.md).

---

## Perintah

| Perintah | Keterangan |
|---|---|
| `pnpm dev` | Server pengembangan |
| `pnpm build` | **Produksi** — `NODE_ENV=production`, guard konfigurasi aktif |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` / `test:unit` | 88 unit test |
| `pnpm test:integration` | 18 integration test — **butuh `DATABASE_URL`** |
| `pnpm db:deploy` / `db:seed` | Migrasi / data contoh |
| `pnpm hash-password` | Membuat `OWNER_PASSWORD_HASH` |

---

## Invarian arsitektur — jangan dilanggar

1. **Static-first (TRD TS-01 P1).** Jalur baca publik tidak menyentuh basis data saat permintaan. Rute publik di keluaran `pnpm build` harus bertanda `○`/`●`, **bukan `ƒ`**. Tanda `ƒ` pada rute publik = regresi.
2. **Otorisasi tiga lapis (TS-05 §5.2).** `proxy.ts` hanya pengalaman pengguna; layout `/admin` lapis kedua; **setiap** Server Action wajib `requireOwner()`. Lapis ketiga yang menentukan.
3. **Markdown teks biasa** sebagai sumber kebenaran konten.
4. **Konten dan komentar kode dalam Bahasa Indonesia.** Ikuti gaya sekitarnya.
5. **Dokumen `docs/` harus ikut disinkronkan** saat perilaku berubah — ada matriks keterlacakan `BR → US → FR → TS` dan indeks `BRULE`/`E-*` yang jumlahnya dicatat di `docs/README.md`.

---

## Jebakan yang sudah pernah memakan waktu

Semua di bawah ini ditemukan dengan cara yang mahal. Jangan ulangi.

### Lingkungan & pengujian

- **Selalu matikan `next-server` lama sebelum uji asap.** Server basi di port 3000 pernah dua kali membuat hasil uji menyesatkan — termasuk sekali setelah `.next` dihapus di bawahnya, yang memunculkan 404 palsu di `/admin`.
  ```bash
  pid=$(ss -ltnp | grep ':3000' | grep -oP 'pid=\K[0-9]+'); [ -n "$pid" ] && kill $pid
  ```
- **`rm -rf .next` sebelum menguji perubahan yang bergantung data.** Next memakai cache prerender; build "berhasil" bisa saja hasil cache lama. Uji jalur kegagalan pernah lolos palsu karenanya.
- **Jangan `tail -3` keluaran vitest.** Baris `Test Files`/`Tests` bisa terpotong sehingga kegagalan terlihat seperti kelulusan. Pakai `grep -E "Test Files|Tests |FAIL"`.
- **`.env` dan `.env.example` diblokir pengaturan izin** — tidak bisa dibaca/ditulis agen. Minta pengguna yang menyuntingnya.
- **Uji integrasi menyentuh data nyata.** Jangan jalankan penghapusan baris bersamaan dengan uji integrasi — pernah membuat kegagalan palsu.

### Next.js 16

- **Konvensi `middleware` usang** → berkasnya `src/proxy.ts`, export bernama `proxy`. Diverifikasi dari sumber terpasang: `build/templates/middleware.js` memanggil `mod.proxy || mod.default`.
- **Area admin wajib `export const dynamic = 'force-dynamic'`** di `src/app/admin/layout.tsx`. Sebelumnya sifat dinamisnya hanya efek samping `auth()` membaca cookie; begitu pembacaan itu hilang, Next mencoba memprerender `/admin` dan build gagal.
- **Satori (`next/og`) memanggil `toString()` pada setiap nilai style.** Properti bernilai `undefined` menggagalkan build. Pakai spread bersyarat: `...(cover ? { textShadow: '…' } : {})`.

### Auth.js v5

- **Provider Credentials tidak mendukung `session.strategy: 'database'`.** Karena itu sesi berupa JWT. Bukan pilihan desain, melainkan batasan pustaka.
- **Augmentasi `declare module 'next-auth/jwt'` tidak berpengaruh** — interface `JWT` dideklarasikan di `@auth/core/jwt` dan meluas `Record<string, unknown>`. Bawa id lewat `token.sub` yang sudah bertipe `string`.
- **Peran dihitung ulang dari `OWNER_EMAIL` pada tiap permintaan**, tidak dipercaya dari token, agar pencabutan akses tidak menunggu token kedaluwarsa.

### Prisma 7 + Neon

- **`prisma.config.ts` tidak boleh menuntut `DIRECT_URL` secara keras.** `env('DIRECT_URL')` gagal saat kosong, dan `prisma generate` adalah langkah **pertama** perintah build — ini pernah mematikan deploy Vercel yang tidak pernah menjalankan migrasi. Sekarang mundur ke `DATABASE_URL`.
- **Driver Neon butuh `globalThis.WebSocket` (Node 22+)** untuk jalur **Node polos** (`db:seed`, `db:deploy`, skrip). Terukur: Node 20.20.2 gagal dengan *"All attempts to open a WebSocket… failed"*.
  **Tetapi `next build` TIDAK terdampak** — Next menyediakan WebSocket sendiri, dan build terverifikasi sukses di Node 20. Jangan salah menyimpulkan kegagalan build Vercel sebagai masalah versi Node.
- **Build membutuhkan basis data yang terjangkau** karena `generateStaticParams` menanyakan daftar artikel. `DATABASE_URL` harus hidup pada tahap **Build**, bukan hanya runtime.
- Versi dipin eksak: `prisma`/`@prisma/client` **7.10.0** (tag `latest` menunjuk RC 8), `next-auth` **5.0.0-beta.32**, ESLint **9.39.5**, TypeScript **6.0.3** (typescript-eslint menolak TS 7).

### Vercel

- **Paket Hobby menolak cron lebih sering dari sekali sehari.** `vercel.json` memakai `0 1 * * *`; BRULE-10 dipenuhi oleh `.github/workflows/publish-cron.yml` tiap 15 menit.
- **Tombol *Redeploy* membangun ulang commit yang sama**, bukan commit terbaru. Periksa kolom *Commit* sebelum menyimpulkan apa pun dari log.
- **Variabel lingkungan punya centang terpisah** untuk Production/Preview/Development. Yang hanya dicentang satu tidak terbaca di environment lain.
- **Nilai env tidak boleh dibungkus tanda kutip.** Kutip hanya untuk berkas `.env`. Nilai terkutip gagal dengan gejala yang identik dengan basis data mati.

---

## Kode kesalahan penyiapan

Dirancang agar log build menjelaskan dirinya sendiri — pertahankan sifat itu.

| Kode | Arti |
|---|---|
| `E-CFG-01` | Kredensial owner / `AUTH_SECRET` kosong di produksi. **Memperingatkan, tidak menggagalkan build** — nilai ini hanya dibutuhkan untuk masuk, dan `/login` sudah menjelaskan diri bila kosong |
| `E-CFG-02` | Versi Node tanpa WebSocket bawaan (hanya jalur Node polos) |
| `E-DB-01` | Basis data gagal dibaca saat prerender; pesannya menyebut penyebab asli **dan** host yang dicoba |

---

## Soal browser (chrome-devtools MCP)

Agen **tidak bisa** memakai Brave harian pengguna. MCP menjalankan instance Brave sendiri dengan profil terpisah di `~/.cache/chrome-devtools-mcp/chrome-profile`, sehingga login pengguna tidak ikut.

- Agen **tidak membuka browser baru tiap kali** — selalu instance yang sama; periksa dengan `list_pages` sebelum menavigasi.
- Menyambung ke Brave harian pengguna butuh remote debugging aktif (`brave://inspect/#remote-debugging`) **dan** `--browserUrl=http://127.0.0.1:9222` di konfigurasi MCP, yang baru berlaku setelah Claude Code dijalankan ulang.
- Memasang pustaka otomasi lain tidak membantu — semuanya memakai CDP dan menabrak batasan yang sama.
- **Jangan pernah memasukkan kredensial pengguna.** Minta pengguna login sendiri di jendela yang dikendalikan.

---

## Keamanan

- Jangan pernah meminta atau menampilkan kata sandi, token, atau connection string utuh. Cukup bagian host.
- Kata sandi owner hanya disimpan sebagai hash scrypt (`src/lib/password.ts`); tidak pernah mentah.
- **Batas yang diketahui:** belum ada pembatasan laju pada percobaan masuk — hanya biaya scrypt (~100 ms) dan syarat 12 karakter. Dicatat di TRD §5.4.
- Pesan gagal masuk tidak membedakan email salah dari kata sandi salah, dan email tak dikenal tetap menjalankan verifikasi umpan (BRULE-38).
