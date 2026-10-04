import { describe, expect, it, vi } from 'vitest'

/** FR-003 / BRULE-01: peran OWNER hanya dari konfigurasi, bukan pendaftaran. */
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('next-auth', () => ({ default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }) }))
vi.mock('next-auth/providers/credentials', () => ({ default: () => ({ id: 'credentials' }) }))
vi.mock('@/lib/env', () => ({
  env: { NODE_ENV: 'test', AUTH_SECRET: 's', OWNER_EMAIL: 'owner@test.id', OWNER_PASSWORD_HASH: 'x' },
  OWNER_EMAIL: 'owner@test.id',
  isAuthConfigured: true,
  isBlobConfigured: false,
  SITE_URL: 'http://localhost:3000',
}))

const { resolveRole } = await import('@/lib/auth')

describe('resolveRole (FR-003, BRULE-01)', () => {
  it('memberi OWNER untuk email owner', () => {
    expect(resolveRole('owner@test.id')).toBe('OWNER')
  })

  it('tidak peka huruf besar-kecil dan mengabaikan spasi tepi', () => {
    expect(resolveRole('OWNER@TEST.ID')).toBe('OWNER')
    expect(resolveRole('Owner@Test.Id')).toBe('OWNER')
    expect(resolveRole('  owner@test.id  ')).toBe('OWNER')
  })

  it('memberi READER untuk email lain — tidak ada jalur menjadi OWNER', () => {
    expect(resolveRole('penyusup@jahat.test')).toBe('READER')
    expect(resolveRole('owner@test.id.jahat.test')).toBe('READER')
    expect(resolveRole('xowner@test.id')).toBe('READER')
  })

  it('memberi READER untuk email kosong atau tidak ada', () => {
    expect(resolveRole(null)).toBe('READER')
    expect(resolveRole(undefined)).toBe('READER')
    expect(resolveRole('')).toBe('READER')
  })
})
