# SETUP — Menjalankan Blogspot

Panduan menyiapkan aplikasi dari nol. Perkiraan waktu: **10–15 menit**.

---

## 1. Prasyarat

| Kebutuhan | Versi teruji |
|---|---|
| Node.js | v26.8.2 (minimal 20.19) |
| pnpm | 10.33 |
| Akun Neon | tier gratis |
| Akun GitHub | untuk repositori & CI (bukan untuk masuk) |

```bash
pnpm install
```

---

## 2. Basis data (Neon)

Buat project Postgres di [console.neon.tech](https://console.neon.tech), lalu salin **dua** connection string:

| Variabel | Bentuk | Dipakai untuk |
|---|---|---|
| `DATABASE_URL` | host ber-`-pooler` | Runtime aplikasi (koneksi pooled) |
| `DIRECT_URL` | host **tanpa** `-pooler` | Migrasi Prisma |

> Keduanya wajib. Prisma 7 membaca `DIRECT_URL` dari `prisma.config.ts` untuk migrasi, sementara runtime memakai driver adapter dengan koneksi pooled.

---

## 3. Kata sandi owner

Blog ini **single-author**: hanya satu akun yang bisa masuk, dan kredensialnya berasal dari variabel lingkungan. Tidak ada halaman pendaftaran — pembaca tidak perlu akun sama sekali, mereka berkomentar sebagai tamu.

```bash
pnpm hash-password
```

Perintah ini meminta kata sandi (minimal 12 karakter, tidak ditampilkan di layar) lalu mencetak satu baris:

```
OWNER_PASSWORD_HASH='scrypt$32768$8$1$...'
```

Salin baris itu ke `.env` dan ke Environment Variables Vercel. **Kata sandi mentah tidak pernah disimpan di mana pun** — yang tersimpan hanya hash scrypt bergaram. Ganti kata sandi = jalankan ulang perintah ini lalu perbarui nilai env (butuh redeploy di produksi).

Untuk keperluan skrip, kata sandi juga bisa dialirkan lewat pipa — dua baris, sandi dan ulangannya:

```bash
printf 'sandi-anda\nsandi-anda\n' | pnpm hash-password
```

> Lupa kata sandi tidak bisa dipulihkan lewat surel — tidak ada alur reset. Buat hash baru dan ganti env-nya.

---

## 4. Variabel lingkungan

Salin `.env.example` menjadi `.env`, lalu isi:

```bash
cp .env.example .env
```

| Variabel | Wajib | Keterangan |
|---|:---:|---|
| `DATABASE_URL` | ✅ | Neon, pooled |
| `DIRECT_URL` | ✅ | Neon, direct — untuk migrasi. Build Vercel tidak memakainya, tetapi CI migrasi wajib punya |
| `AUTH_SECRET` | ✅ | Hasilkan: `openssl rand -base64 32`. **Wajib di produksi** — build gagal tanpa ini |
| `AUTH_URL` | ✅ | `http://localhost:3000` |
| `OWNER_EMAIL` | ✅ | Email untuk masuk. **Hanya email ini yang memperoleh peran OWNER** |
| `OWNER_PASSWORD_HASH` | ✅ | Keluaran `pnpm hash-password` dari langkah 3 |
| `NEXT_PUBLIC_SITE_URL` | ✅ | URL kanonik; dipakai sitemap, RSS, dan OG image |
| `BLOB_READ_WRITE_TOKEN` | — | Vercel Blob. Tanpa ini, unggah gambar dinonaktifkan (fitur lain tetap jalan) |
| `CRON_SECRET` | — | Melindungi `/api/cron/publish`. Wajib bila memakai penjadwalan terbit |

> ⚠ Bila `OWNER_EMAIL`, `OWNER_PASSWORD_HASH`, atau `AUTH_SECRET` kosong di produksi, **deploy tetap berhasil** tetapi log build memuat peringatan `E-CFG-01` yang menyebut variabel mana yang kosong. Situs publik tetap tayang; halaman `/login` menjelaskan bahwa autentikasi belum dikonfigurasi dan `/admin` tetap tertutup. Nilai-nilai ini tidak dibutuhkan untuk membangun situs — hanya untuk masuk — jadi tidak sepantasnya memblokir seluruh deploy.
>
> ⚠ `.env` sudah masuk `.gitignore`. Jangan pernah commit berkas ini.

---

## 5. Migrasi & data contoh

```bash
pnpm db:deploy   # terapkan migrasi
pnpm db:seed     # 3 artikel contoh + 1 draf + komentar uji (idempoten)
```

---

## 6. Jalankan

```bash
pnpm dev
```

Buka `http://localhost:3000`, lalu masuk lewat `http://localhost:3000/login`.

---

## 7. Verifikasi cepat

| Perintah | Harapan |
|---|---|
| `pnpm typecheck` | tanpa galat |
| `pnpm lint` | bersih |
| `pnpm test:unit` | 88 tes lulus |
| `pnpm test:integration` | 18 tes lulus (butuh `DATABASE_URL`) |
| `pnpm build` | sukses; rute publik bertanda `○`/`●`, bukan `ƒ` |

> Tanda `ƒ` pada rute publik berarti halaman itu menyentuh basis data setiap permintaan — melanggar prinsip static-first (TRD TS-01 P1).

---

## 8. Deploy ke Vercel

1. Hubungkan repo ke Vercel (framework terdeteksi otomatis).
2. Isi seluruh variabel lingkungan di *Project Settings → Environment Variables*, dengan `AUTH_URL` dan `NEXT_PUBLIC_SITE_URL` memakai domain produksi.
3. Isi `OWNER_EMAIL`, `OWNER_PASSWORD_HASH`, dan `AUTH_SECRET`. Tanpa ketiganya deploy tetap jadi, tetapi Anda belum bisa masuk — periksa log build untuk peringatan `E-CFG-01` yang menyebut variabel mana yang kosong.
4. **Migrasi dijalankan sebagai langkah CI terpisah**, bukan di perintah build — build paralel dapat berlomba mengubah skema yang sama (TRD TS-11 §11.4). Sudah terpasang di [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): setiap push ke `main` menjalankan typecheck, lint, dan uji lebih dulu, baru `prisma migrate deploy` dalam satu antrean tunggal. Isi dua secret repositori di *Settings → Secrets and variables → Actions*:

   | Secret | Isi |
   |---|---|
   | `DATABASE_URL` | Koneksi terkumpul (pooled) Neon produksi |
   | `DIRECT_URL` | Koneksi langsung Neon produksi — dipakai Prisma untuk migrasi |

   > Tanpa kedua secret itu, job `migrate` gagal dan uji integrasi dilewati diam-diam (disengaja, agar PR dari fork tidak gagal). Bila ingin migrasi produksi menunggu persetujuan manual, tambahkan `environment: production` pada job `migrate` lalu pasang *required reviewers* di pengaturan environment.
5. Penjadwalan terbit memakai **dua penjadwal**, karena paket Vercel Hobby **menolak deploy** bila `vercel.json` memuat cron yang berjalan lebih dari sekali sehari:

   | Penjadwal | Berkas | Interval | Peran |
   |---|---|---|---|
   | Vercel Cron | [`vercel.json`](../vercel.json) | `0 1 * * *` (08:00 WIB) | Jaring pengaman harian; aman di Hobby |
   | GitHub Actions | [`publish-cron.yml`](../.github/workflows/publish-cron.yml) | `*/15 * * * *` | Pemenuh BRULE-10 yang sesungguhnya, gratis |

   Vercel mengirim header `Authorization: Bearer $CRON_SECRET` secara otomatis selama `CRON_SECRET` terisi di Environment Variables. Untuk penjadwal GitHub, isi dua secret repositori: `PRODUCTION_URL` (mis. `https://blog.contoh.com`) dan `CRON_SECRET` — **nilainya harus sama persis** dengan yang di Vercel, kalau tidak endpoint menjawab 401. Endpoint ini idempoten, jadi dipanggil dua penjadwal sekaligus tidak masalah.

   > Bila kedua secret belum diisi, workflow-nya diam saja — tidak gagal. Jalankan manual lewat tab *Actions → Terbitkan artikel terjadwal → Run workflow* untuk menguji penyiapan.
   >
   > Penjadwal GitHub Actions gratis **tidak dijamin tepat waktu** (kerap melar saat beban tinggi) dan otomatis nonaktif setelah repositori 60 hari tanpa aktivitas. Bila ketepatan terbit itu penting, naik ke Vercel Pro lalu kembalikan `vercel.json` ke `*/15 * * * *` dan hapus workflow ini. Kelayakan Hobby sendiri bergantung pada **OQ-4** (apakah blog dipakai komersial).

---

## Pemecahan masalah

| Gejala | Sebab & solusi |
|---|---|
| `Cannot resolve environment variable: DIRECT_URL` | `.env` belum ada atau `DIRECT_URL` kosong |
| Form masuk tidak muncul | `OWNER_EMAIL` atau `OWNER_PASSWORD_HASH` kosong — halaman login sengaja menampilkan penjelasan, bukan form yang diam-diam gagal |
| Log build memuat `E-CFG-01 ✗ KOSONG <VARIABEL>` | Variabel itu belum terbaca saat build. Periksa centang *Production/Preview/Development* pada variabel tersebut di Vercel — centang yang hanya satu environment tidak terbaca di environment lain |
| Situs tayang tapi `/login` berkata "belum dikonfigurasi" | Sama seperti di atas: salah satu dari `OWNER_EMAIL`, `OWNER_PASSWORD_HASH`, `AUTH_SECRET` kosong |
| Deploy gagal: `[E-DB-01] Gagal membaca basis data saat memprerender …` | Build memprerender halaman publik, jadi `DATABASE_URL` harus bisa dihubungi pada tahap **Build**, bukan hanya runtime. Baris *Penyebab asli* di bawahnya menyebut masalah sesungguhnya (kredensial salah, host tidak ada, dsb.) |
| Deploy gagal: `Failed to collect page data for …` tanpa penjelasan | Versi lama. Sejak `E-DB-01` dipasang, penyebab aslinya ikut tercetak. Pastikan memakai commit terbaru |
| "Email atau kata sandi salah" padahal yakin benar | Hash disalin tidak utuh. Nilainya memuat `$` — bungkus dengan kutip tunggal di `.env`, dan tempel apa adanya di Vercel |
| Masuk berhasil tapi ditolak di `/admin` | `OWNER_EMAIL` berbeda dari email yang Anda ketik saat masuk |
| Unggah gambar gagal | `BLOB_READ_WRITE_TOKEN` belum diisi |
| Prisma memperingatkan versi Node | Node 26 di luar daftar dukungan resmi Prisma 7, namun terverifikasi berjalan normal |
| Deploy Vercel gagal: `PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL` | Versi lama `prisma.config.ts` menuntut `DIRECT_URL` saat `prisma generate` — langkah pertama build. Sudah diperbaiki: kini mundur ke `DATABASE_URL`. Pastikan memakai commit terbaru |
| Build lokal `pnpm build` gagal `E-CFG-01` padahal `pnpm dev` jalan | `pnpm build` memakai `NODE_ENV=production`, jadi guard-nya aktif. Tambahkan `OWNER_EMAIL`, `OWNER_PASSWORD_HASH`, dan `AUTH_SECRET` ke `.env` lokal |
