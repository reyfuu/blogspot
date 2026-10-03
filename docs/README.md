# Dokumentasi Perencanaan — Blog Pribadi (`blogspot`)

Set dokumen perencanaan untuk blog pribadi single-author yang akan dideploy di **Vercel** dengan basis data **Neon Postgres**.

Keempat dokumen ini dirancang sebagai **satu sistem yang saling terhubung**, bukan empat dokumen terpisah: setiap kebutuhan bisnis dapat ditelusuri sampai ke spesifikasi teknis yang mengimplementasikannya.

---

## Urutan Baca

| # | Dokumen | Menjawab pertanyaan | Pembaca utama |
|---|---|---|---|
| 1 | **[BRD.md](./BRD.md)** — *Business Requirements* | **Kenapa** proyek ini ada? Apa tujuan, batasan, biaya, dan risikonya? | Pengambil keputusan |
| 2 | **[PRD.md](./PRD.md)** — *Product Requirements* | **Apa** yang dibangun, untuk siapa, dan mana yang masuk MVP? | Produk & desain |
| 3 | **[FRD.md](./FRD.md)** — *Functional Requirements* | **Bagaimana sistem berperilaku** pada setiap input, aturan, dan kondisi gagal? | Implementor & QA |
| 4 | **[TRD.md](./TRD.md)** — *Technical Requirements* | **Bagaimana membangunnya** — arsitektur, data, keamanan, deployment? | Engineer |

> Baca berurutan bila baru pertama kali. Untuk langsung mengerjakan kode, mulai dari **TRD Lampiran B — Urutan Implementasi**, dan rujuk balik ke FRD saat butuh detail perilaku.

---

## Konvensi ID

Setiap requirement punya ID stabil. Dokumen hilir selalu mereferensikan ID hulu.

```
BR-##  (BRD)  →  EP-## / US-###  (PRD)  →  FR-###  (FRD)  →  TS-##  (TRD)
```

| Prefix | Arti | Lokasi definisi | Jumlah |
|---|---|---|---|
| `BR-##` | Tujuan bisnis | BRD §3 | 8 |
| `EP-##` | Epic produk | PRD §5 | 5 |
| `US-###` | User story | PRD §5 | 44 |
| `FR-###` | Requirement fungsional | FRD §4–§11 | 53 |
| `BRULE-##` | Aturan bisnis | FRD (inline) · indeks di Lampiran B | 35 |
| `TS-##` | Spesifikasi teknis | TRD | 16 |
| `E-*` | Kode kesalahan | FRD §12 | 25 |

**Matriks keterlacakan utama** ada di [BRD §12](./BRD.md#12-matriks-keterlacakan). Pemetaan balik `TS → FR` ada di [TRD TS-16](./TRD.md#ts-16--keterlacakan-ts--fr).

### Memeriksa integritas keterlacakan

```bash
cd docs
# Semua ID yang direferensikan harus punya definisi
grep -ohE '\b(BR|EP|US|FR|TS|BRULE)-[0-9]+' *.md | sort -u
```

---

## Ringkasan Keputusan yang Sudah Dikunci

| Aspek | Keputusan |
|---|---|
| Cakupan | Blog pribadi **single-author** — bukan multi-tenant, bukan multi-penulis (v1) |
| Peran | `OWNER` (satu pemilik) + `READER` (pembaca yang berkomentar) + `GUEST` |
| Stack | Next.js App Router · Neon Postgres · Prisma · Auth.js · Tiptap · Vercel Blob · Tailwind |
| Prinsip arsitektur | **Static-first** — jalur baca publik tidak menyentuh basis data |
| Format konten | **Markdown teks biasa** sebagai sumber kebenaran (portabilitas) |
| Moderasi | **Seluruh** komentar wajib disetujui owner sebelum tampil |
| Deployment | Vercel · `main` → Production · setiap PR → Preview dengan branch Neon terisolasi |
| Repositori | `https://github.com/reyfuu/blogspot.git` |

---

## Open Question — Perlu Keputusan Sebelum Implementasi

Dikumpulkan dari seluruh dokumen. Tanda ⛔ berarti memblokir pekerjaan tertentu.

| ID | Pertanyaan | Memblokir | Sumber |
|---|---|---|---|
| **OQ-1** | Nama merek dan domain final? | ⛔ Konfigurasi SEO, OG image, `NEXT_PUBLIC_SITE_URL` | BRD §11 |
| **OQ-2** | Penyedia OAuth: GitHub, Google, atau keduanya? | ⛔ Implementasi autentikasi (TS-05), variabel lingkungan | BRD §11 |
| **OQ-3** | Komentar tamu diizinkan, atau wajib login? | ⛔ Cakupan FR-071 | BRD §11 |
| **OQ-4** | Blog dipakai untuk tujuan komersial? | Menentukan kelayakan Vercel Hobby (BR-03) | BRD §11 |
| **OQ-5** | Perlu halaman kebijakan privasi sejak v1? | Kepatuhan penyimpanan email pengomentar (C-5) | BRD §11 |
| **OQ-6** | Komentar ditutup otomatis setelah berapa hari? | Nilai bawaan BRULE-34 | PRD §9 |
| **OQ-7** | Pencarian: kueri sederhana atau full-text search? | Desain indeks basis data (TS-03) | PRD §9 |

---

## Status Dokumen

| Dokumen | Versi | Status | Terakhir diperbarui |
|---|---|---|---|
| BRD.md | 1.0 | 🟡 Draft — menunggu review | 2026-10-03 |
| PRD.md | 1.0 | 🟡 Draft — menunggu review | 2026-10-03 |
| FRD.md | 1.0 | 🟡 Draft — menunggu review | 2026-10-03 |
| TRD.md | 1.0 | 🟡 Draft — menunggu review | 2026-10-03 |

**Legenda:** 🟡 Draft · 🔵 Dalam review · 🟢 Disetujui

---

## Catatan Verifikasi

Angka versi paket dan batas kuota vendor (Vercel, Neon) dalam TRD adalah **acuan perencanaan per Oktober 2026** dan wajib dikonfirmasi ke dokumentasi resmi saat implementasi dimulai.
