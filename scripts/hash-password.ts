/**
 * Menghasilkan nilai OWNER_PASSWORD_HASH.
 *
 *   pnpm hash-password
 *
 * Kata sandi dibaca dari stdin tanpa gema, bukan dari argumen baris perintah —
 * argumen ikut tercatat di riwayat shell dan terlihat di daftar proses.
 */
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { hashPassword } from '../src/lib/password'

const MIN_LENGTH = 12

let muted = false

// Stream perantara: menelan gema ketikan, tetapi meneruskan prompt.
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk)
    callback()
  },
})

const rl = createInterface({ input: process.stdin, output, terminal: true })

async function prompt(question: string): Promise<string> {
  muted = false
  const pending = rl.question(question)
  // Dimatikan tepat setelah prompt tercetak, sebelum ketikan pertama masuk.
  muted = true
  const answer = await pending
  muted = false
  process.stdout.write('\n')
  return answer
}

function fail(message: string): never {
  rl.close()
  console.error(message)
  process.exit(1)
}

const password = await prompt('Kata sandi owner: ')
const again = await prompt('Ulangi: ')
rl.close()

if (!password) fail('Kata sandi kosong — dibatalkan.')
if (password !== again) fail('Kedua masukan tidak sama — dibatalkan.')
if (password.length < MIN_LENGTH) fail(`Minimal ${MIN_LENGTH} karakter — dibatalkan.`)

console.log('\nSalin baris ini ke Environment Variables Vercel (dan .env lokal):\n')
console.log(`OWNER_PASSWORD_HASH='${await hashPassword(password)}'`)
console.log()
