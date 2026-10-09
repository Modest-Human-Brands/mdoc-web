import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { effectScope } from 'vue'

import { FALLBACK_FONTS, resetFontCache, useFonts } from '../useFonts'

afterEach(() => {
  vi.unstubAllGlobals()
  resetFontCache()
})

function setup() {
  const scope = effectScope()
  return scope.run(() => useFonts())!
}

describe('useFonts', () => {
  it('loads the list from the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify([{ family: 'Inter', name: 'Inter' }]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    )
    const fonts = setup()

    await fonts.search('int')

    expect(fonts.fonts.value).toEqual([{ family: 'Inter', name: 'Inter' }])
    expect(fonts.offline.value).toBe(false)
    expect(fonts.loading.value).toBe(false)
  })

  it('falls back to the built-in list when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.reject(new TypeError('offline'))),
    )
    const fonts = setup()

    await fonts.search('')

    expect(fonts.fonts.value).toEqual(FALLBACK_FONTS)
    expect(fonts.offline.value).toBe(true)
  })

  it('reports whether a saved font is known to the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(JSON.stringify([{ family: 'Poppins', name: 'Poppins' }]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    )
    const fonts = setup()

    expect(await fonts.isKnown('Exo 2')).toBe(true)
    expect(await fonts.isKnown('poppins')).toBe(true)
    expect(await fonts.isKnown('Georgia')).toBe(false)
  })

  it('cannot tell when the server is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.reject(new TypeError('offline'))),
    )

    expect(await setup().isKnown('Georgia')).toBeNull()
  })

  it('fetches the featured list once per session and reuses it', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ family: 'Inter', name: 'Inter' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await setup().search('')
    await setup().search('')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})