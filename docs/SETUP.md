# SETUP — Menjalankan Blogspot

Panduan menyiapkan aplikasi dari nol. Perkiraan waktu: **10–15 menit**.

---

## 1. Prasyarat

| Kebutuhan | Versi teruji |
|---|---|
| Node.js | v26.8.2 (minimal 20.19) |
| pnpm | 10.33 |
| Akun Neon | tier gratis |
| Akun GitHub | untuk OAuth |

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

## 3. GitHub OAuth App

Bagian ini **harus Anda lakukan sendiri** — kredensial OAuth tidak dapat dibuatkan.

1. Buka **[github.com/settings/developers](https://github.com/settings/developers)** → *OAuth Apps* → **New OAuth App**
2. Isi:
   | Kolom | Nilai (pengembangan) |
   |---|---|
   | Application name | Blogspot (dev) |
   | Homepage URL | `http://localhost:3000` |
   | Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |
3. **Register application** → **Generate a new client secret**
4. Salin *Client ID* dan *Client secret*

> Untuk produksi, buat OAuth App **terpisah** dengan domain asli pada kedua URL di atas. Satu app tidak bisa melayani dua domain.

---

## 4. Variabel lingkungan

Salin `.env.example` menjadi `.env`, lalu isi:

```bash
cp .env.example .env
```

| Variabel | Wajib | Keterangan |
|---|:---:|---|
| `DATABASE_URL` | ✅ | Neon, pooled |
| `DIRECT_URL` | ✅ | Neon, direct — untuk migrasi |
| `AUTH_SECRET` | ✅ | Hasilkan: `openssl rand -base64 32` |
| `AUTH_URL` | ✅ | `http://localhost:3000` |
| `AUTH_GITHUB_ID` | ✅ | Dari langkah 3 |
| `AUTH_GITHUB_SECRET` | ✅ | Dari langkah 3 |
| `OWNER_EMAILS` | ✅ | Email GitHub Anda. **Hanya email di daftar ini yang memperoleh peran OWNER** |
| `NEXT_PUBLIC_SITE_URL` | ✅ | URL kanonik; dipakai sitemap, RSS, dan OG image |
| `BLOB_READ_WRITE_TOKEN` | — | Vercel Blob. Tanpa ini, unggah gambar dinonaktifkan (fitur lain tetap jalan) |
| `CRON_SECRET` | — | Melindungi `/api/cron/publish`. Wajib bila memakai penjadwalan terbit |

> ⚠ `OWNER_EMAILS` wajib memakai email yang **terverifikasi di GitHub**. Email yang tidak terdaftar di sini akan masuk sebagai `READER` dan ditolak di `/admin` — ini disengaja (BRULE-01).
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
| `pnpm test:unit` | 65 tes lulus |
| `pnpm test:integration` | 18 tes lulus (butuh `DATABASE_URL`) |
| `pnpm build` | sukses; rute publik bertanda `○`/`●`, bukan `ƒ` |

> Tanda `ƒ` pada rute publik berarti halaman itu menyentuh basis data setiap permintaan — melanggar prinsip static-first (TRD TS-01 P1).

---

## 8. Deploy ke Vercel

1. Hubungkan repo ke Vercel (framework terdeteksi otomatis).
2. Isi seluruh variabel lingkungan di *Project Settings → Environment Variables*, dengan `AUTH_URL` dan `NEXT_PUBLIC_SITE_URL` memakai domain produksi.
3. Buat OAuth App produksi (lihat catatan di langkah 3).
4. **Migrasi dijalankan sebagai langkah CI terpisah**, bukan di perintah build — build paralel dapat berlomba mengubah skema yang sama (TRD TS-11 §11.4).
5. Untuk penjadwalan terbit, tambahkan Vercel Cron ke `/api/cron/publish` (interval ≤ 15 menit) dengan header `Authorization: Bearer $CRON_SECRET`.

---

## Pemecahan masalah

| Gejala | Sebab & solusi |
|---|---|
| `Cannot resolve environment variable: DIRECT_URL` | `.env` belum ada atau `DIRECT_URL` kosong |
| Tombol masuk tidak muncul | `AUTH_GITHUB_ID`/`SECRET` kosong — halaman login sengaja menampilkan penjelasan, bukan tombol yang diam-diam gagal |
| Masuk berhasil tapi ditolak di `/admin` | Email Anda tidak ada di `OWNER_EMAILS`, atau belum terverifikasi di GitHub |
| `redirect_uri_mismatch` | Callback URL di OAuth App tidak sama persis dengan `AUTH_URL` + `/api/auth/callback/github` |
| Unggah gambar gagal | `BLOB_READ_WRITE_TOKEN` belum diisi |
| Prisma memperingatkan versi Node | Node 26 di luar daftar dukungan resmi Prisma 7, namun terverifikasi berjalan normal |
