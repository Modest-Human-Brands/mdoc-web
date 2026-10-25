import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/config', () => ({ config: { apiBaseUrl: '', apiKey: 'secret-key' } }))

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
})