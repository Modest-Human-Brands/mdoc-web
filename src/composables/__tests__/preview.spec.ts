import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { effectScope, nextTick, ref } from 'vue'

import { usePreview } from '../usePreview'

const ONE_PAGE = '%PDF-1.4 mock'
const TWO_PAGES = '%PDF-1.4 mock two pages'

function previewResponse(
  pdf: string,
  extra: { pageCount?: number; warnings?: { field: string; message: string }[] } = {},
) {
  return new Response(JSON.stringify({ pdfBase64: btoa(pdf), pageCount: 1, ...extra }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('usePreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('stays empty without a template and sends one request after edits settle', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(previewResponse(TWO_PAGES)))
    vi.stubGlobal('fetch', fetchMock)
    const templateId = ref<string | null>(null)
    const variables = ref<Record<string, unknown>>({ a: '1' })
    const scope = effectScope()
    const preview = scope.run(() => usePreview(templateId, variables))!

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(preview.url.value).toBeNull()

    templateId.value = 'invoice'
    await nextTick()
    variables.value = { a: '12' }
    await nextTick()
    variables.value = { a: '123' }
    await nextTick()

    await vi.advanceTimersByTimeAsync(500)
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1]
    expect(JSON.parse(init?.body as string)).toEqual({
      templateId: 'invoice',
      variant: 'filled',
      variables: { a: '123' },
    })
    expect(preview.url.value).toBe('blob:mock')
    scope.stop()
  })

  it('restarts the wait on every keystroke, so a long typing burst sends only one request', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(previewResponse(TWO_PAGES)))
    vi.stubGlobal('fetch', fetchMock)
    const variables = ref<Record<string, unknown>>({ name: '' })
    const scope = effectScope()
    scope.run(() => usePreview(ref('invoice'), variables))
    await vi.advanceTimersByTimeAsync(600)
    fetchMock.mockClear()

    for (let i = 1; i <= 20; i++) {
      variables.value = { name: 'x'.repeat(i) }
      await vi.advanceTimersByTimeAsync(300)
    }
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(800)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('uses the API draft mode and exposes pageCount and warnings from the response', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        previewResponse(TWO_PAGES, {
          pageCount: 2,
          warnings: [{ field: 'recipient.email', message: 'Invalid recipient email' }],
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const scope = effectScope()
    const preview = scope.run(() =>
      usePreview(ref('invoice'), ref({ recipient: { email: 'acc' } })),
    )!

    await vi.advanceTimersByTimeAsync(900)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/document/template/preview?draft=true')
    expect(preview.pageCount.value).toBe(2)
    expect(preview.warnings.value).toEqual([
      { field: 'recipient.email', message: 'Invalid recipient email' },
    ])
    expect(preview.error.value).toBeNull()
    scope.stop()
  })

  it('shows the error and keeps the last good PDF when a render fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(previewResponse(ONE_PAGE))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ statusCode: 400, statusMessage: 'templateId is required.' }),
          {
            status: 400,
          },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const templateId = ref<string | null>('invoice')
    const variables = ref<Record<string, unknown>>({ a: '1' })
    const scope = effectScope()
    const preview = scope.run(() => usePreview(templateId, variables))!

    await vi.advanceTimersByTimeAsync(900)
    expect(preview.url.value).toBe('blob:mock')

    variables.value = { a: '2' }
    await vi.advanceTimersByTimeAsync(900)

    expect(preview.error.value).toBe('templateId is required.')
    expect(preview.url.value).toBe('blob:mock')
    scope.stop()
  })

  it('renders at once when a discrete change flushes the pending request', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(previewResponse(ONE_PAGE)))
    vi.stubGlobal('fetch', fetchMock)
    const variables = ref<Record<string, unknown>>({ a: '1' })
    const flush = ref(0)
    const scope = effectScope()
    scope.run(() => usePreview(ref('invoice'), variables, 'filled', flush))
    await vi.advanceTimersByTimeAsync(900)
    fetchMock.mockClear()

    variables.value = { a: '2' }
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchMock).not.toHaveBeenCalled()

    flush.value++
    await nextTick()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    scope.stop()
  })
})