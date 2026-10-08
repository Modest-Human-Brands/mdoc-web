import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { blobFromUrl, pdfFileName, safeFileName, saveBlob } from '../download'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('file names', () => {
  it('removes characters that are not allowed in file names', () => {
    expect(safeFileName('Invoice: A/B*C?')).toBe('Invoice A B C')
    expect(safeFileName('a\\b')).toBe('a b')
    expect(safeFileName('   ')).toBe('document')
    expect(safeFileName('', 'fallback')).toBe('fallback')
  })

  it('always ends in a single .pdf', () => {
    expect(pdfFileName('MHB-I-26-001')).toBe('MHB-I-26-001.pdf')
    expect(pdfFileName('MHB-I-26-001.PDF')).toBe('MHB-I-26-001.pdf')
    expect(pdfFileName('Billing Invoice (draft)')).toBe('Billing Invoice (draft).pdf')
  })
})

describe('saveBlob', () => {
  it('clicks a temporary download link with the file name and cleans up', () => {
    vi.useFakeTimers()
    const create = vi.fn<(blob: Blob) => string>(() => 'blob:saved')
    const revoke = vi.fn<(url: string) => void>()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    saveBlob(new Blob(['%PDF'], { type: 'application/pdf' }), 'MHB-I-26-001.pdf')

    expect(click).toHaveBeenCalledTimes(1)
    const clicked = click.mock.contexts[0] as HTMLAnchorElement
    expect(clicked.getAttribute('download')).toBe('MHB-I-26-001.pdf')
    expect(clicked.getAttribute('href')).toBe('blob:saved')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000)
    expect(revoke).toHaveBeenCalledWith('blob:saved')
    click.mockRestore()
  })
})

describe('blobFromUrl', () => {
  it('returns the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(new Response('%PDF-1.4', { status: 200 }))),
    )

    const blob = await blobFromUrl('blob:preview')

    expect(await blob.text()).toBe('%PDF-1.4')
  })

  it('throws a readable error when the download fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(new Response('nope', { status: 404 }))),
    )

    await expect(blobFromUrl('/api/x')).rejects.toThrow('Download failed (404).')
  })
})