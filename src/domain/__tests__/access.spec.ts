import { describe, expect, it } from 'vite-plus/test'

import { readConfig } from '@/config'

import {
  ACCESS_KEY,
  accessErrors,
  clearAccess,
  isConnected,
  loadAccess,
  safeNext,
  saveAccess,
} from '../access'

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => void (data[key] = value),
    removeItem: (key: string) => void delete data[key],
  }
}

describe('access storage', () => {
  it('round-trips trimmed details', () => {
    const store = memory()
    saveAccess({ organizationId: ' acme ', userId: 'u1', apiKey: ' k ' }, store)

    expect(loadAccess(store)).toEqual({ organizationId: 'acme', userId: 'u1', apiKey: 'k' })
    clearAccess(store)
    expect(store.data[ACCESS_KEY]).toBeUndefined()
  })

  it('is empty for missing or corrupt data', () => {
    expect(loadAccess(memory()).apiKey).toBe('')
    expect(loadAccess(memory({ [ACCESS_KEY]: '{oops' })).userId).toBe('')
  })
})

describe('accessErrors', () => {
  it('requires user id and API key, organization is optional', () => {
    const errors = accessErrors({ organizationId: '', userId: ' ', apiKey: '' })

    expect(Object.keys(errors).sort()).toEqual(['apiKey', 'userId'])
  })

  it('rejects an organization with spaces', () => {
    expect(
      accessErrors({ organizationId: 'my org', userId: 'u', apiKey: 'k' }).organizationId,
    ).toBeTruthy()
  })
})

describe('isConnected and safeNext', () => {
  it('needs both a user id and a key', () => {
    expect(isConnected({ userId: 'u', apiKey: 'k' })).toBe(true)
    expect(isConnected({ userId: 'u', apiKey: '' })).toBe(false)
  })

  it('only returns to same-app paths', () => {
    expect(safeNext('/documents?x=1')).toBe('/documents?x=1')
    expect(safeNext('//evil.example')).toBe('/documents')
    expect(safeNext('https://evil.example')).toBe('/documents')
    expect(safeNext('/setup')).toBe('/documents')
    expect(safeNext(undefined)).toBe('/documents')
  })
})

describe('config precedence', () => {
  it('prefers details saved in this browser over runtime and build values', () => {
    const config = readConfig(
      { userId: 'runtime', apiKey: 'runtime-key' },
      { userId: 'build' },
      { userId: 'saved', apiKey: '', organizationId: '' },
    )

    expect(config.userId).toBe('saved')
    expect(config.apiKey).toBe('runtime-key')
  })
})