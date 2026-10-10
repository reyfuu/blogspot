/**
 * Menghasilkan nilai OWNER_PASSWORD_HASH.
 *
 *   pnpm hash-password                                  # interaktif, tanpa gema
 *   printf 'sandi\nsandi\n' | pnpm hash-password        # dari pipa, untuk skrip
 *
 * Kata sandi dibaca dari stdin, bukan dari argumen baris perintah — argumen
 * ikut tercatat di riwayat shell dan terlihat di daftar proses.
 */
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { hashPassword } from '../src/lib/password'

const MIN_LENGTH = 12

// Mematikan gema hanya masuk akal di terminal. Untuk masukan dari pipa,
// readline justru menelan seluruh aliran sekaligus sehingga pertanyaan kedua
// tidak pernah terjawab — jadi di sana stdin dibaca langsung.
const interaktif = process.stdin.isTTY === true

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function bacaDariPipa(): Promise<[string, string]> {
  const potongan: Buffer[] = []
  for await (const bagian of process.stdin) potongan.push(Buffer.from(bagian))
  const baris = Buffer.concat(potongan).toString('utf8').split('\n')
  return [baris[0] ?? '', baris[1] ?? '']
}

async function bacaInteraktif(): Promise<[string, string]> {
  let muted = false

  // Stream perantara: menelan gema ketikan, tetapi meneruskan prompt.
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk)
      callback()
    },
  })

  const rl = createInterface({ input: process.stdin, output, terminal: true })

  const tanya = async (question: string): Promise<string> => {
    muted = false
    const pending = rl.question(question)
    // Dimatikan tepat setelah prompt tercetak, sebelum ketikan pertama masuk.
    muted = true
    const answer = await pending
    muted = false
    process.stdout.write('\n')
    return answer
  }

  try {
    return [await tanya('Kata sandi owner: '), await tanya('Ulangi: ')]
  } finally {
    rl.close()
  }
}

const [password, again] = interaktif ? await bacaInteraktif() : await bacaDariPipa()

if (!password) fail('Kata sandi kosong — dibatalkan.')
if (password !== again) fail('Kedua masukan tidak sama — dibatalkan.')
if (password.length < MIN_LENGTH) fail(`Minimal ${MIN_LENGTH} karakter — dibatalkan.`)

console.log('\nSalin baris ini ke Environment Variables Vercel (dan .env lokal):\n')
console.log(`OWNER_PASSWORD_HASH='${await hashPassword(password)}'`)
console.log()
