import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
  createBlobUrl,
  isBlobHeld,
  releaseBlob,
  resetBlobRegistry,
  retainBlob,
} from '../blobRegistry'

describe('blobRegistry', () => {
  let revoked: string[]

  beforeEach(() => {
    vi.useFakeTimers()
    resetBlobRegistry()
    revoked = []
    let n = 0
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: () => `blob:test/${++n}`,
        revokeObjectURL: (url: string) => revoked.push(url),
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('revokes a URL shortly after its last holder releases it', async () => {
    const url = createBlobUrl(new Blob(['x']))
    releaseBlob(url)
    expect(revoked).toEqual([])

    await vi.advanceTimersByTimeAsync(1000)
    expect(revoked).toEqual([url])
  })

  it('keeps a URL alive while any holder remains', async () => {
    const url = createBlobUrl(new Blob(['x']))
    retainBlob(url)
    releaseBlob(url)
    await vi.advanceTimersByTimeAsync(5000)

    expect(revoked).toEqual([])
    expect(isBlobHeld(url)).toBe(true)

    releaseBlob(url)
    await vi.advanceTimersByTimeAsync(1000)
    expect(revoked).toEqual([url])
  })

  it('does not revoke a URL that was retained again during the grace period', async () => {
    const url = createBlobUrl(new Blob(['x']))
    releaseBlob(url)
    retainBlob(url)
    await vi.advanceTimersByTimeAsync(2000)

    expect(revoked).toEqual([])
  })

  it('ignores non-blob URLs', async () => {
    retainBlob('data:image/png;base64,AA')
    releaseBlob('data:image/png;base64,AA')
    releaseBlob(null)
    await vi.advanceTimersByTimeAsync(2000)

    expect(revoked).toEqual([])
  })
})