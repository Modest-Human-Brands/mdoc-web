import { describe, expect, it } from 'vite-plus/test'

import { pickConfig, readConfig } from '../config'

describe('pickConfig', () => {
  it('returns the first non-blank value, trimmed', () => {
    expect(pickConfig(undefined, '  ', ' abc ', 'later')).toBe('abc')
  })

  it('is an empty string when nothing is set', () => {
    expect(pickConfig()).toBe('')
    expect(pickConfig(undefined, '')).toBe('')
  })
})

describe('readConfig', () => {
  it('reads Vite variables during development (no runtime config)', () => {
    const config = readConfig(undefined, { userId: 'dev-user', projectId: 'p1' })

    expect(config).toMatchObject({ userId: 'dev-user', projectId: 'p1', contactId: '' })
  })

  it('prefers the runtime config written by the container over build-time values', () => {
    const config = readConfig(
      { userId: 'runtime-user', apiBaseUrl: 'https://api.example.com' },
      { userId: 'build-user', apiBaseUrl: '/api-from-build' },
    )

    expect(config.userId).toBe('runtime-user')
    expect(config.apiBaseUrl).toBe('https://api.example.com')
  })

  it('falls back to the build-time value when the runtime value is blank (empty config.js)', () => {
    const config = readConfig({ userId: '', organizationId: '  ' }, { userId: 'dev-user' })

    expect(config.userId).toBe('dev-user')
    expect(config.organizationId).toBe('')
  })
})