# BRD — Business Requirements Document
**Proyek:** Blog Pribadi (codename: `blogspot`)
**Versi:** 1.0 (Draft)
**Tanggal:** 2026-10-03
**Pemilik dokumen:** Owner proyek
**Status:** Draft — menunggu review

---

## 1. Ringkasan Eksekutif

Proyek ini membangun **platform blog pribadi single-author** yang dimiliki penuh oleh satu orang, dideploy di **Vercel** dengan basis data **Neon Postgres**. Tujuannya menyediakan kanal publikasi tulisan milik sendiri — bebas dari pembatasan platform pihak ketiga (iklan, algoritma feed, penguncian data) — dengan biaya operasional mendekati nol pada skala awal.

Berbeda dengan memakai Medium, Substack, atau Blogger, pendekatan self-hosted di Vercel memberi kendali penuh atas data, tampilan, SEO, dan arah pengembangan jangka panjang. Berbeda pula dengan generator statis murni (Hugo/Astro + Markdown di repo), penggunaan database memungkinkan **penulisan dan moderasi langsung dari browser** tanpa perlu akses terminal atau commit manual — syarat penting agar kebiasaan menulis benar-benar berkelanjutan.

Lingkup rilis pertama (v1) mencakup empat pilar: autentikasi & manajemen akun, editor artikel, SEO & performa, serta komentar & interaksi pembaca.

---

## 2. Latar Belakang & Pernyataan Masalah

| # | Masalah | Dampak saat ini |
|---|---|---|
| P-1 | Tulisan tersebar di platform pihak ketiga | Data dan audiens tidak portabel; risiko konten hilang bila platform berubah kebijakan atau tutup |
| P-2 | Platform pihak ketiga menyisipkan iklan, paywall, dan rekomendasi konten orang lain | Pengalaman baca terganggu; kredibilitas dan fokus pada tulisan berkurang |
| P-3 | Kustomisasi tampilan dan struktur URL sangat terbatas | SEO tidak optimal; identitas visual tidak bisa dibangun |
| P-4 | Alternatif static site generator mensyaratkan alur kerja berbasis terminal + git commit | Friksi menulis tinggi; tidak bisa menulis atau mengoreksi dari perangkat lain/ponsel; frekuensi publikasi menurun |
| P-5 | Tidak ada kendali atas moderasi komentar | Diskusi tidak terkelola, atau fitur komentar terpaksa dimatikan sama sekali |

**Peluang:** kombinasi Next.js + Vercel + Neon kini memungkinkan platform blog berbasis database berjalan di tier gratis dengan performa setara situs statis (berkat ISR dan edge CDN), sambil tetap menyediakan dashboard penulisan berbasis web.

---

## 3. Tujuan Bisnis & Metrik Sukses

Setiap tujuan punya ID stabil yang direferensikan dokumen hilir (PRD/FRD/TRD).

| ID | Tujuan Bisnis | Metrik Sukses (terukur) | Target waktu |
|---|---|---|---|
| **BR-01** | Memiliki kepemilikan dan portabilitas penuh atas konten | 100% konten tersimpan di database milik sendiri; tersedia mekanisme ekspor seluruh artikel ke Markdown | Rilis v1 |
| **BR-02** | Menurunkan friksi menulis sehingga publikasi menjadi rutin | Waktu dari "buka editor" → "artikel tayang" **< 10 menit** untuk artikel 800 kata; minimal **2 artikel terbit/bulan** selama 3 bulan pertama | Bulan ke-3 pasca rilis |
| **BR-03** | Menjaga biaya operasional mendekati nol pada skala awal | Biaya infrastruktur bulanan **≤ USD 0** di tier gratis (di luar domain ±USD 12/tahun) pada beban ≤ 10.000 pageview/bulan | Berkelanjutan |
| **BR-04** | Mendapatkan trafik organik dari mesin pencari | **≥ 1.000 kunjungan organik/bulan** pada bulan ke-6; 100% artikel terbit terindeks Google dalam 7 hari | Bulan ke-6 |
| **BR-05** | Memberikan pengalaman baca yang cepat dan nyaman di semua perangkat | Core Web Vitals lolos ambang "Good" (LCP < 2,5s; INP < 200ms; CLS < 0,1) pada **≥ 90% kunjungan nyata**; skor Lighthouse Accessibility ≥ 95 | Rilis v1 |
| **BR-06** | Membangun interaksi dengan pembaca secara terkendali | Fitur komentar aktif dengan **0 spam lolos ke publik**; owner memproses antrian moderasi **< 24 jam** | Rilis v1 |
| **BR-07** | Mengamankan akses administratif dan integritas data | 0 insiden akses tidak sah; backup/restore basis data teruji minimal 1× sebelum rilis | Rilis v1 |
| **BR-08** | Menjaga fondasi teknis agar dapat dikembangkan tanpa penulisan ulang | Penambahan penulis kedua atau fitur newsletter dapat dilakukan **tanpa migrasi destruktif** pada skema data | Rilis v1 (desain) |

---

## 4. Stakeholder

| Pihak | Peran | Kepentingan utama |
|---|---|---|
| **Owner / Penulis** | Pemilik produk, penulis tunggal, administrator, sekaligus pengembang | Kemudahan menulis, kendali penuh, biaya rendah |
| **Pembaca umum** | Pengguna akhir (anonim) | Konten relevan, halaman cepat, mudah dibaca di ponsel |
| **Pembaca terdaftar** | Pengguna akhir yang login untuk berkomentar | Bisa berdiskusi, identitas konsisten |
| **Mesin pencari** | Kanal distribusi utama (bukan manusia, tapi menentukan keberhasilan BR-04) | Struktur data valid, sitemap, kecepatan, konten unik |
| **Penyedia layanan** (Vercel, Neon) | Vendor infrastruktur | Kepatuhan pada batas tier dan syarat layanan |

### 4.1 RACI (ringkas)

| Aktivitas | Owner | Pembaca | Vendor |
|---|---|---|---|
| Penentuan ruang lingkup & prioritas | **A/R** | I | — |
| Penulisan & publikasi konten | **A/R** | I | — |
| Moderasi komentar | **A/R** | C | — |
| Pengembangan & deployment | **A/R** | — | C |
| Ketersediaan infrastruktur | A | — | **R** |

> A = Accountable, R = Responsible, C = Consulted, I = Informed.
> Catatan: seluruh peran R terpusat pada satu orang — ini **batasan kapasitas utama** proyek (lihat C-1).

---

## 5. Ruang Lingkup

### 5.1 In Scope (v1)

| Pilar | Cakupan |
|---|---|
| **Autentikasi & akun** | Login OAuth untuk owner; proteksi area `/admin`; akun pembaca untuk berkomentar; manajemen sesi |
| **Authoring & editor** | Editor rich text dengan keluaran Markdown/MDX; draft & autosave; penjadwalan terbit; slug otomatis; tag; gambar sampul; unggah media; pratinjau draft |
| **SEO & performa** | Metadata per halaman; OG image dinamis; `sitemap.xml`; `robots.txt`; feed RSS; structured data JSON-LD; canonical URL; optimasi Core Web Vitals |
| **Komentar & interaksi** | Komentar dari pembaca login maupun tamu; antrian moderasi; balasan 1 tingkat; anti-spam; tombol bagikan |
| **Tampilan publik** | Beranda, halaman artikel, arsip, halaman tag, paginasi, pencarian dasar, halaman statis (Tentang), dark mode |
| **Operasional** | Deployment Vercel, environment Production/Preview, migrasi basis data, monitoring dasar, prosedur backup |

### 5.2 Out of Scope (v1 — eksplisit tidak dikerjakan)

| Item | Alasan | Pertimbangan ulang |
|---|---|---|
| Multi-tenant (banyak user punya blog masing-masing) | Kompleksitas besar; bertentangan dengan tujuan blog pribadi | Tidak direncanakan |
| Multi-penulis / editorial workflow | Hanya satu penulis; tetap disiapkan di skema data | v2 |
| Monetisasi, paywall, langganan berbayar | Bukan tujuan bisnis saat ini | v2 |
| Newsletter / email broadcast | Menambah vendor & biaya; fokus v1 pada publikasi | v1.1 |
| Multi-bahasa (i18n) | Menggandakan kerja konten & SEO | v2 |
| Aplikasi mobile native | Web responsif sudah memadai | Tidak direncanakan |
| Analitik kustom / dashboard trafik mendalam | Cukup memakai Vercel Analytics bawaan | v1.1 |
| Impor otomatis dari platform lama | Volume konten awal kecil; cukup manual | Sesuai kebutuhan |
| Komentar bertingkat > 1 level | Kompleksitas UI tidak sebanding manfaat pada skala kecil | v1.1 |

---

## 6. Asumsi

| ID | Asumsi | Konsekuensi bila salah |
|---|---|---|
| **A-1** | Blog dijalankan satu orang sebagai penulis tunggal; "manajemen user" berarti satu role `OWNER` + role `READER` untuk pembaca yang berkomentar | Bila ternyata butuh banyak penulis, perlu tambahan role & UI (skema sudah mengantisipasi) |
| **A-2** | Volume awal ≤ 10.000 pageview/bulan dan ≤ 500 artikel | Melebihi ini berarti keluar dari tier gratis (lihat bagian 8) |
| **A-3** | Pembaca dapat berkomentar sebagai tamu; seluruh komentar wajib melewati moderasi sebelum tampil | Bila moderasi manual terlalu memberatkan, perlu auto-approve bersyarat (v1.1) |
| **A-4** | Owner nyaman dengan alur kerja berbasis git untuk pengembangan, tapi **tidak** untuk menulis konten | Menentukan keputusan konten-di-database, bukan konten-di-repo |
| **A-5** | Vercel dan Neon tetap menyediakan tier gratis dengan batasan yang setara selama periode proyek | Perubahan kebijakan vendor memicu evaluasi ulang biaya (R-4) |
| **A-6** | Bahasa konten utama adalah Bahasa Indonesia; antarmuka publik berbahasa Indonesia | Menentukan `lang` HTML, format tanggal, dan strategi SEO |
| **A-7** | Nama merek dan domain final belum ditentukan; `blogspot` adalah placeholder internal | Perlu keputusan sebelum peluncuran publik (lihat Open Question OQ-1) |

---

## 7. Dependensi & Batasan

### 7.1 Dependensi eksternal

| ID | Dependensi | Sifat | Catatan |
|---|---|---|---|
| D-1 | Akun & proyek **Vercel** | Wajib | Hosting, CDN, build pipeline |
| D-2 | Akun & proyek **Neon Postgres** | Wajib | Basis data utama; fitur branching dipakai untuk preview |
| D-3 | **Penyedia OAuth** (GitHub dan/atau Google) | Wajib | Autentikasi owner dan pembaca |
| D-4 | **Vercel Blob** (atau setara) | Wajib | Penyimpanan gambar unggahan |
| D-5 | **Registrar domain** | Wajib sebelum peluncuran publik | Biaya tahunan |
| D-6 | Repositori **GitHub** | Wajib | Sumber deployment Vercel & CI |

### 7.2 Batasan

| ID | Batasan | Implikasi |
|---|---|---|
| **C-1** | Sumber daya manusia: **1 orang** merangkap produk, pengembangan, konten, dan operasi | Ruang lingkup v1 harus dijaga ketat; otomasi diprioritaskan di atas fitur manual |
| **C-2** | Anggaran infrastruktur: **USD 0/bulan** di luar domain | Semua pilihan teknologi wajib punya tier gratis yang memadai |
| **C-3** | Batas tier gratis Vercel (eksekusi fungsi, bandwidth) dan Neon (jam komputasi, penyimpanan) | Arsitektur harus static-first agar hit ke database minimal |
| **C-4** | Neon tier gratis melakukan **auto-suspend** saat idle | Cold start harus dimitigasi, atau jalur baca publik dibuat tidak menyentuh database |
| **C-5** | Kepatuhan privasi dasar (penanganan email komentar) | Wajib ada kebijakan privasi dan penyimpanan data pembaca seminimal mungkin |

---

## 8. Analisis Biaya

### 8.1 Skala awal (sesuai A-2)

| Komponen | Tier | Biaya/bulan |
|---|---|---|
| Vercel Hobby | Gratis (non-komersial) | USD 0 |
| Neon Free | Gratis | USD 0 |
| Vercel Blob | Kuota gratis | USD 0 |
| OAuth provider | Gratis | USD 0 |
| Domain | Berbayar tahunan | ± USD 1/bulan (ekuivalen USD 12/tahun) |
| **Total** | | **± USD 1/bulan** |

### 8.2 Titik pemicu kenaikan biaya

| Pemicu | Konsekuensi | Perkiraan biaya |
|---|---|---|
| Blog dipakai untuk aktivitas komersial | Vercel mewajibkan paket Pro | ± USD 20/bulan |
| Trafik melampaui kuota bandwidth Hobby | Upgrade Vercel Pro | ± USD 20/bulan |
| Penyimpanan/komputasi melampaui Neon Free | Upgrade Neon berbayar | mulai ± USD 19/bulan |
| Kebutuhan newsletter (v1.1) | Tambah penyedia email | USD 0–20/bulan |

> **Catatan verifikasi:** angka di atas adalah perkiraan perencanaan. Harga dan batas kuota vendor berubah dari waktu ke waktu dan **wajib dikonfirmasi ke halaman harga resmi Vercel dan Neon** sebelum keputusan anggaran final.

---

## 9. Analisis Risiko

Skala: Dampak & Kemungkinan = Rendah / Sedang / Tinggi.

| ID | Risiko | Dampak | Kemungkinan | Mitigasi | Tujuan terkait |
|---|---|---|---|---|---|
| **R-1** | Spam komentar membanjiri situs | Sedang | **Tinggi** | Moderasi wajib sebelum tampil; honeypot; rate limiting per IP; validasi panjang & tautan; opsi menutup komentar per artikel | BR-06 |
| **R-2** | Cold start Neon memperlambat halaman | Sedang | Sedang | Jalur baca publik disajikan statis/ISR sehingga tidak menyentuh database saat request; connection pooling; gunakan driver serverless | BR-05, C-4 |
| **R-3** | Kehilangan data konten (hapus tak sengaja, kegagalan DB) | **Tinggi** | Rendah | Soft delete pada artikel; mengandalkan point-in-time restore Neon; ekspor berkala ke Markdown; uji restore sebelum rilis | BR-01, BR-07 |
| **R-4** | Ketergantungan vendor (lock-in Vercel/Neon) | Sedang | Rendah | Pakai Postgres standar (portabel); hindari API eksklusif vendor di lapisan domain; abstraksi penyimpanan media | BR-01, BR-03 |
| **R-5** | Proyek mangkrak karena kapasitas 1 orang | **Tinggi** | Sedang | Ruang lingkup v1 dijaga ketat; MVP cut-line tegas; fitur non-esensial didorong ke v1.1 | C-1 |
| **R-6** | Trafik organik tidak tercapai | Sedang | Sedang | SEO teknis lengkap sejak hari pertama; konsistensi terbit; struktur internal link; pemantauan Search Console | BR-04 |
| **R-7** | Akun owner diambil alih | **Tinggi** | Rendah | OAuth (tanpa password tersimpan); daftar putih email owner; sesi berumur pendek untuk area admin; audit log aksi admin | BR-07 |
| **R-8** | Konten berbahaya tersuntik lewat editor/komentar (XSS) | **Tinggi** | Sedang | Sanitasi Markdown/HTML di sisi server; render komentar sebagai teks biasa; Content Security Policy | BR-07 |
| **R-9** | Biaya melonjak tanpa disadari | Sedang | Rendah | Pantau kuota; aktifkan notifikasi penggunaan vendor; batasi ukuran & jumlah unggahan media | BR-03 |
| **R-10** | Perubahan slug merusak tautan yang sudah terindeks | Sedang | Sedang | Slug dikunci setelah terbit; simpan riwayat slug dan lakukan redirect 301 | BR-04 |

---

## 10. Roadmap Tingkat Tinggi

| Rilis | Fokus | Isi utama | Kriteria selesai |
|---|---|---|---|
| **v1 (MVP)** | Bisa menulis, terbit, ditemukan, dan dikomentari | 4 pilar in-scope + tampilan publik + deployment | Seluruh `BR-01`…`BR-08` punya implementasi; Core Web Vitals lolos; 3 artikel nyata terbit |
| **v1.1** | Mengurangi kerja manual & memperkaya interaksi | Auto-approve komentar bersyarat, notifikasi email, newsletter dasar, analitik ringkas, komentar bertingkat | Antrian moderasi < 5 menit/hari |
| **v2** | Perluasan | Multi-penulis + editorial workflow, i18n, monetisasi/membership | Ditentukan ulang berdasarkan capaian v1 |

---

## 11. Open Question (perlu keputusan sebelum implementasi)

| ID | Pertanyaan | Blocking untuk |
|---|---|---|
| **OQ-1** | Nama merek dan domain final? | Peluncuran publik, konfigurasi SEO & OG image |
| **OQ-2** | Penyedia OAuth yang dipakai: GitHub, Google, atau keduanya? | Implementasi autentikasi (TS-05) |
| **OQ-3** | Apakah komentar tamu (tanpa login) benar-benar diizinkan, atau wajib login? | Desain modul komentar (M7) |
| **OQ-4** | Apakah blog akan dipakai untuk tujuan komersial? | Menentukan kelayakan Vercel Hobby (BR-03) |
| **OQ-5** | Perlukah halaman kebijakan privasi sejak v1 (terkait penyimpanan email pengomentar)? | Kepatuhan (C-5) |

---

## 12. Matriks Keterlacakan

Memetakan tujuan bisnis → epic produk (PRD) → requirement fungsional (FRD) → spesifikasi teknis (TRD). Setiap `BR` wajib punya jalur lengkap sampai `TS`; tidak boleh ada baris kosong.

| Tujuan Bisnis | Epic (PRD) | Requirement Fungsional (FRD) | Spesifikasi Teknis (TRD) |
|---|---|---|---|
| **BR-01** Kepemilikan & portabilitas konten | EP-02 | FR-020, FR-021, FR-035, FR-036 | TS-03, TS-04, TS-13 |
| **BR-02** Friksi menulis rendah | EP-02 | FR-022, FR-023, FR-024, FR-025, FR-030, FR-031, FR-032 | TS-04, TS-06, TS-07 |
| **BR-03** Biaya operasional minimal | EP-03 | FR-043, FR-058 | TS-01, TS-07, TS-10, TS-11 |
| **BR-04** Trafik organik | EP-03, EP-05 | FR-060, FR-061, FR-062, FR-063, FR-064, FR-065, FR-027 | TS-08, TS-07 |
| **BR-05** Pengalaman baca cepat & nyaman | EP-05 | FR-043, FR-050, FR-051, FR-052, FR-053, FR-054, FR-055, FR-056, FR-057, FR-058 | TS-06, TS-07, TS-10 |
| **BR-06** Interaksi terkendali | EP-04 | FR-070, FR-071, FR-072, FR-073, FR-074, FR-075, FR-076 | TS-06, TS-09 |
| **BR-07** Keamanan & integritas data | EP-01 | FR-001, FR-002, FR-003, FR-004, FR-005, FR-036, FR-082 | TS-05, TS-09, TS-11, TS-12 |
| **BR-08** Fondasi dapat dikembangkan | EP-01, EP-02 | FR-005, FR-020, FR-035 | TS-02, TS-03, TS-11 |

---

## 13. Persetujuan

| Peran | Nama | Status | Tanggal |
|---|---|---|---|
| Owner proyek | — | Menunggu review | — |

---

## Riwayat Revisi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-10-03 | Draft awal |
