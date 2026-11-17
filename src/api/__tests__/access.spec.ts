import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/config', () => ({ config: { apiBaseUrl: '', apiKey: 'configured' } }))

import { ApiError } from '@/api'
import { verifyAccess } from '../access'

afterEach(() => vi.unstubAllGlobals())

const access = { organizationId: 'acme', userId: 'u1', apiKey: ' typed-key ' }

describe('verifyAccess', () => {
  it('sends the typed key and organization, not the configured key', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ documents: [] })))
    vi.stubGlobal('fetch', fetchMock)

    await verifyAccess(access)

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/document?limit=1')
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      'x-api-key': 'typed-key',
      'x-org-id': 'acme',
    })
  })

  it('explains a rejected key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(new Response('{}', { status: 401 }))),
    )

    await expect(verifyAccess(access)).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('API key'),
    })
  })

  it('reports an unreachable server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.reject(new TypeError('failed'))),
    )

    await expect(verifyAccess(access)).rejects.toBeInstanceOf(ApiError)
  })
})