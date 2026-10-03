import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Menguji penegakan otorisasi (TS-05 §5.2 lapis 3) dengan men-stub sesi.
 *
 * Ini bagian paling rawan dari seluruh aplikasi: satu Server Action yang lupa
 * memanggil requireOwner() membuka seluruh area admin. Karena itu diuji per
 * peran, bukan hanya jalur bahagia.
 */

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/env', () => ({
  env: { NODE_ENV: 'test', OWNER_EMAILS: 'owner@test.id' },
  OWNER_EMAILS: ['owner@test.id'],
  isGitHubAuthConfigured: false,
  isBlobConfigured: false,
  SITE_URL: 'http://localhost:3000',
}))

const { AuthorizationError, getSessionUser, isOwner, requireOwner, requireUser } = await import('@/lib/guard')

beforeEach(() => mockAuth.mockReset())

const asOwner = () => mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'owner@test.id', role: 'OWNER' } })
const asReader = () => mockAuth.mockResolvedValue({ user: { id: 'u2', email: 'reader@test.id', role: 'READER' } })
const asAnon = () => mockAuth.mockResolvedValue(null)

describe('requireOwner (FR-002)', () => {
  it('meloloskan OWNER', async () => {
    asOwner()
    await expect(requireOwner()).resolves.toMatchObject({ id: 'u1', role: 'OWNER' })
  })

  it('menolak READER dengan E-AUTH-04 / 403', async () => {
    asReader()
    await expect(requireOwner()).rejects.toThrow(AuthorizationError)
    await requireOwner().catch((e: InstanceType<typeof AuthorizationError>) => {
      expect(e.code).toBe('E-AUTH-04')
      expect(e.status).toBe(403)
    })
  })

  it('menolak anonim dengan E-AUTH-01 / 401', async () => {
    asAnon()
    await requireOwner().catch((e: InstanceType<typeof AuthorizationError>) => {
      expect(e.code).toBe('E-AUTH-01')
      expect(e.status).toBe(401)
    })
  })

  it('menolak sesi tanpa email', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u3', role: 'OWNER' } })
    await expect(requireOwner()).rejects.toThrow(AuthorizationError)
  })

  it('menolak sesi tanpa id', async () => {
    mockAuth.mockResolvedValue({ user: { email: 'owner@test.id', role: 'OWNER' } })
    await expect(requireOwner()).rejects.toThrow(AuthorizationError)
  })

  it('peran bawaan adalah READER bila tidak disebutkan — bukan OWNER', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u4', email: 'x@test.id' } })
    const user = await getSessionUser()
    expect(user?.role).toBe('READER')
    await expect(requireOwner()).rejects.toThrow(AuthorizationError)
  })
})

describe('requireUser', () => {
  it('meloloskan READER', async () => {
    asReader()
    await expect(requireUser()).resolves.toMatchObject({ role: 'READER' })
  })
  it('menolak anonim', async () => {
    asAnon()
    await expect(requireUser()).rejects.toThrow(AuthorizationError)
  })
})

describe('isOwner', () => {
  it('benar hanya untuk OWNER', async () => {
    asOwner()
    expect(await isOwner()).toBe(true)
    asReader()
    expect(await isOwner()).toBe(false)
    asAnon()
    expect(await isOwner()).toBe(false)
  })
})

describe('pesan galat tidak membocorkan detail teknis', () => {
  it('pesan ditulis untuk pengguna', async () => {
    asReader()
    const err = await requireOwner().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AuthorizationError)
    const message = (err as Error).message
    expect(message).toBe('Anda tidak memiliki akses ke halaman ini.')
    expect(message).not.toMatch(/stack|prisma|sql|undefined/i)
  })
})

/**
 * Setiap Server Action tag WAJIB menolak non-owner. Satu action yang lupa
 * memanggil requireOwner() membuka pengelolaan tag ke publik.
 */
describe('aksi tag menolak non-owner (FR-084)', () => {
  it('requireOwner adalah satu-satunya gerbang yang dipakai aksi tag', async () => {
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../src/actions/tags.ts', import.meta.url), 'utf8'),
    )
    const exported = [...source.matchAll(/export async function (\w+)/g)].map((m) => m[1])
    expect(exported).toEqual(expect.arrayContaining(['renameTag', 'mergeTags', 'deleteTag']))

    // Setiap fungsi yang diekspor harus memanggil requireOwner sebelum apa pun.
    for (const name of exported) {
      const body = source.slice(source.indexOf(`export async function ${name}`))
      const upToFirstAwait = body.slice(0, body.indexOf('const parsed'))
      expect(upToFirstAwait, `${name} tidak memanggil requireOwner lebih dulu`).toContain('requireOwner()')
    }
  })
})
