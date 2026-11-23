import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/config', () => ({
  config: { apiBaseUrl: '', apiKey: 'secret-key', organizationId: 'acme', userId: 'user-1' },
}))

import { documentsApi } from '@/api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('x-api-key', () => {
  it('is sent on every request when the app is configured with a key', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'd1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await documentsApi.get('d1')
    await documentsApi.void('d1', 'No longer needed')

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'x-api-key': 'secret-key' })
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      'x-api-key': 'secret-key',
      'Content-Type': 'application/json',
    })
  })

  it('scopes every request to the organization and the acting user', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ id: 'd1' })))
    vi.stubGlobal('fetch', fetchMock)

    await documentsApi.get('d1')

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      'x-org-id': 'acme',
      'x-user-id': 'user-1',
    })
  })
})