import { describe, expect, it, vi } from 'vitest'

/** FR-003 / BRULE-01: peran OWNER hanya dari konfigurasi, bukan pendaftaran. */
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('next-auth', () => ({ default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }) }))
vi.mock('next-auth/providers/github', () => ({ default: () => ({ id: 'github' }) }))
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }))
vi.mock('@/lib/env', () => ({
  env: { NODE_ENV: 'test', AUTH_SECRET: 's', AUTH_GITHUB_ID: '', AUTH_GITHUB_SECRET: '' },
  OWNER_EMAILS: ['owner@test.id', 'kedua@test.id'],
  isGitHubAuthConfigured: false,
  isBlobConfigured: false,
  SITE_URL: 'http://localhost:3000',
}))

const { resolveRole } = await import('@/lib/auth')

describe('resolveRole (FR-003, BRULE-01)', () => {
  it('memberi OWNER untuk email yang terdaftar', () => {
    expect(resolveRole('owner@test.id')).toBe('OWNER')
    expect(resolveRole('kedua@test.id')).toBe('OWNER')
  })

  it('tidak peka huruf besar-kecil', () => {
    expect(resolveRole('OWNER@TEST.ID')).toBe('OWNER')
    expect(resolveRole('Owner@Test.Id')).toBe('OWNER')
  })

  it('memberi READER untuk email lain — pendaftaran mandiri tidak menghasilkan OWNER', () => {
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
