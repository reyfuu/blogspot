/** A-6: format tanggal lokal Indonesia; disimpan UTC, ditampilkan lokal. */
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})

export function formatDate(date: Date): string {
  return dateFormatter.format(date)
}

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date)
}
