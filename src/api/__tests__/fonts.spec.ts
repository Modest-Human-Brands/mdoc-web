import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { fontsApi } from '../fonts'

afterEach(() => vi.unstubAllGlobals())

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fontsApi', () => {
  it('searches with q and limit and returns family and name', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(respond([{ family: 'Open Sans', name: 'OpenSans' }])),
    )
    vi.stubGlobal('fetch', fetchMock)

    const fonts = await fontsApi.list({ q: 'open', limit: 5 })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fonts?q=open&limit=5')
    expect(fonts).toEqual([{ family: 'Open Sans', name: 'OpenSans' }])
  })

  it('asks for the featured list when there is no query', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(respond([])))
    vi.stubGlobal('fetch', fetchMock)

    await fontsApi.list()

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/fonts')
  })
})