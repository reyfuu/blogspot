/**
 * Seed data contoh agar aplikasi dapat diverifikasi end-to-end.
 * Idempoten: aman dijalankan berulang kali.
 */
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../src/generated/prisma/client.js'

const connectionString = process.env['DATABASE_URL']
if (!connectionString) throw new Error('DATABASE_URL belum diset')

const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

const OWNER_EMAIL = (process.env['OWNER_EMAILS'] ?? 'owner@example.com').split(',')[0]!.trim()

const POSTS = [
  {
    slug: 'menulis-lagi',
    title: 'Menulis lagi, kali ini di rumah sendiri',
    excerpt:
      'Kenapa saya memindahkan tulisan dari platform pihak ketiga ke blog yang saya kelola sendiri, dan apa yang berubah setelahnya.',
    tags: ['catatan', 'menulis'],
    content: `Selama beberapa tahun saya menulis di platform orang lain. Nyaman di awal, menyesakkan di akhir.

## Masalahnya bukan fiturnya

Platform pihak ketiga umumnya punya editor yang baik. Yang jadi masalah adalah hal-hal di sekitarnya:

- tulisan saya diselingi rekomendasi artikel orang lain
- struktur URL tidak bisa saya atur
- data pembaca bukan milik saya
- suatu hari kebijakan berubah, dan saya tidak punya pilihan

## Yang saya inginkan

Sederhana saja:

1. Menulis dari peramban, tanpa ritual \`git commit\` untuk setiap typo
2. Halaman yang cepat, bahkan di jaringan seluler yang buruk
3. Konten tersimpan sebagai teks biasa yang bisa saya bawa pergi kapan saja

Poin ketiga ternyata yang paling menentukan arsitekturnya.

## Keputusan teknisnya

Isi artikel disimpan sebagai Markdown di basis data, bukan HTML. Konsekuensinya:
editor boleh berganti, kerangka kerja boleh berganti, tulisannya tetap terbaca.

\`\`\`ts
// Sumber kebenaran adalah Markdown, bukan hasil render.
const html = await renderMarkdown(post.content)
\`\`\`

Halaman publik disajikan statis dan tidak menyentuh basis data saat dibaca. Jadi
meski basis data sedang tidur, blog ini tetap hidup.

> Tulisan yang tidak bisa Anda pindahkan sebenarnya bukan milik Anda.

Itu saja. Mari menulis lagi.`,
  },
  {
    slug: 'catatan-tentang-kecepatan',
    title: 'Catatan tentang kecepatan halaman',
    excerpt:
      'Kecepatan bukan soal angka di Lighthouse, tapi soal apakah pembaca bisa membaca sebelum kehilangan minat.',
    tags: ['catatan', 'performa'],
    content: `Ada perbedaan besar antara "skor Lighthouse 100" dan "halaman ini terasa cepat".

## Yang benar-benar dirasakan pembaca

Tiga hal, berurutan:

1. **Berapa lama sampai teks muncul.** Kalau pembaca harus menatap layar kosong, semua optimasi lain tidak ada artinya.
2. **Apakah layout bergeser.** Teks yang melompat saat gambar selesai dimuat lebih menyebalkan daripada halaman yang lambat sedikit.
3. **Apakah interaksi merespons.** Tombol yang butuh 300 ms untuk bereaksi terasa rusak.

## Keputusan yang paling berpengaruh

Bukan mengecilkan gambar. Bukan juga mengganti font. Yang paling berpengaruh adalah
**tidak mengirim JavaScript yang tidak perlu**.

Blog ini melakukan pewarnaan sintaks di server. Pembaca menerima HTML yang sudah
berwarna, tanpa satu byte pun pustaka highlight di peramban.

| Pendekatan | JS ke klien |
|---|---|
| Highlight di klien | ~100 KB+ |
| Highlight saat render server | 0 KB |

Artikel ini bisa dibaca penuh dengan JavaScript dimatikan. Itu bukan kebetulan —
itu persyaratan.`,
  },
  {
    slug: 'sanitasi-input-bukan-opsional',
    title: 'Sanitasi input bukan fitur opsional',
    excerpt:
      'Setiap tempat yang menerima teks dari orang lain adalah permukaan serangan. Komentar paling sering dilupakan.',
    tags: ['keamanan'],
    content: `Kalau sistem Anda menerima teks dari orang lain, Anda sudah punya permukaan serangan.
Pertanyaannya hanya apakah Anda sudah menanganinya atau belum.

## Dua jalur masuk di blog ini

**Isi artikel** ditulis oleh pemilik blog. Tingkat kepercayaannya tinggi, tapi tetap
disanitasi — karena "penulis tidak akan menyerang dirinya sendiri" bukan jaminan
kalau suatu hari ada penulis kedua.

**Komentar** ditulis siapa pun. Tingkat kepercayaannya nol.

## Keputusan untuk komentar

Komentar tidak diproses sebagai Markdown. Sama sekali.

Isinya dirender sebagai teks biasa, baris baru dipertahankan, URL tidak dijadikan
tautan otomatis. Biayanya: pengomentar tidak bisa menebalkan kata. Imbalannya:
seluruh permukaan XSS dari input tidak tepercaya hilang.

Untuk blog pribadi, itu pertukaran yang jelas menguntungkan.

## Untuk isi artikel

Sanitasi memakai daftar-izin, dan dijalankan **setelah** semua transformasi lain:

\`\`\`ts
.use(rehypeShiki, { /* ... */ })
.use(rehypeExternalLinks)
// Sanitasi TERAKHIR — agar tidak ada plugin yang bisa menyelundupkan elemen.
.use(rehypeSanitize, sanitizeSchema)
\`\`\`

Urutannya penting. Sanitasi di tengah pipeline berarti plugin sesudahnya bisa
memasukkan kembali apa pun.`,
  },
]

async function main() {
  console.log('Seeding…')

  const owner = await db.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      email: OWNER_EMAIL,
      name: 'Rey',
      role: 'OWNER',
      bio: 'Menulis catatan teknis dan esai pendek.',
      emailVerified: new Date(),
    },
    update: { role: 'OWNER' },
    select: { id: true, email: true },
  })
  console.log(`  owner: ${owner.email}`)

  await db.setting.upsert({
    where: { key: 'site' },
    create: {
      key: 'site',
      value: {
        siteName: 'Catatan Rey',
        tagline: 'Catatan teknis dan esai pendek',
        description:
          'Blog pribadi berisi catatan teknis, keputusan rekayasa, dan esai pendek seputar pengembangan perangkat lunak.',
        authorName: 'Rey',
        authorBio: 'Menulis tentang rekayasa perangkat lunak, performa web, dan keputusan teknis sehari-hari.',
        commentsEnabled: true,
        guestCommentsEnabled: true,
        autoCloseCommentsAfterDays: null,
        postsPerPage: 20,
      },
    },
    update: {},
  })

  let offset = POSTS.length
  for (const p of POSTS) {
    const tagIds: string[] = []
    for (const name of p.tags) {
      const tag = await db.tag.upsert({
        where: { slug: name },
        create: { slug: name, name },
        update: {},
        select: { id: true },
      })
      tagIds.push(tag.id)
    }

    const words = p.content.split(/\s+/).filter(Boolean).length
    // Tanggal terbit dibuat berjenjang agar urutan kronologis terlihat.
    const publishedAt = new Date(Date.now() - offset * 36 * 60 * 60 * 1000)
    offset -= 1

    const post = await db.post.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        status: 'PUBLISHED',
        publishedAt,
        authorId: owner.id,
        wordCount: words,
        readingTime: Math.max(1, Math.ceil(words / 200)),
      },
      update: { content: p.content, excerpt: p.excerpt, title: p.title },
      select: { id: true, slug: true },
    })

    await db.postTag.deleteMany({ where: { postId: post.id } })
    await db.postTag.createMany({ data: tagIds.map((tagId) => ({ postId: post.id, tagId })) })
    console.log(`  artikel: ${post.slug}`)
  }

  // Satu draf, agar dapat diverifikasi bahwa draf TIDAK bocor ke publik/sitemap.
  await db.post.upsert({
    where: { slug: 'draf-belum-selesai' },
    create: {
      slug: 'draf-belum-selesai',
      title: 'Draf yang belum selesai',
      content: 'Tulisan ini masih draf dan tidak boleh tampil publik.',
      status: 'DRAFT',
      authorId: owner.id,
    },
    update: {},
  })
  console.log('  draf: draf-belum-selesai (untuk uji kebocoran)')

  // Satu komentar PENDING + satu APPROVED, untuk memverifikasi BRULE-28.
  const first = await db.post.findUnique({ where: { slug: POSTS[0]!.slug }, select: { id: true } })
  if (first) {
    const existing = await db.comment.count({ where: { postId: first.id } })
    if (existing === 0) {
      await db.comment.createMany({
        data: [
          {
            postId: first.id,
            body: 'Setuju soal portabilitas. Saya juga akhirnya pindah ke self-hosted.',
            status: 'APPROVED',
            guestName: 'Dina',
            guestEmail: 'dina@example.com',
          },
          {
            postId: first.id,
            body: 'Komentar ini masih menunggu moderasi dan tidak boleh tampil publik.',
            status: 'PENDING',
            guestName: 'Pengirim Uji',
            guestEmail: 'uji@example.com',
          },
        ],
      })
      console.log('  komentar: 1 APPROVED + 1 PENDING')
    }
  }

  console.log('Seed selesai.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void db.$disconnect())
