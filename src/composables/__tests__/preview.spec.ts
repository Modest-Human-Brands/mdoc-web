import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { effectScope, nextTick, ref } from 'vue'

import { countPdfPages, usePreview } from '../usePreview'

const ONE_PAGE = '%PDF-1.4 1 0 obj << /Type /Pages /Count 1 >> 2 0 obj << /Type /Page >>'
const TWO_PAGES = `${ONE_PAGE} 3 0 obj << /Type /Page >>`

function previewResponse(pdf: string) {
  return new Response(JSON.stringify({ pdfBase64: btoa(pdf) }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('countPdfPages', () => {
  it('counts /Type /Page but not /Pages', () => {
    expect(countPdfPages(ONE_PAGE)).toBe(1)
    expect(countPdfPages(TWO_PAGES)).toBe(2)
    expect(countPdfPages('not a pdf')).toBe(1)
  })
})

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

  it('stays empty without a template and debounces rapid edits into one request', async () => {
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
    await vi.advanceTimersByTimeAsync(500)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1]
    expect(JSON.parse(init?.body as string)).toEqual({
      templateId: 'invoice',
      variables: { a: '123' },
    })
    expect(preview.url.value).toBe('blob:mock')
    expect(preview.pages.value).toBe(2)
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

    await vi.advanceTimersByTimeAsync(500)
    expect(preview.url.value).toBe('blob:mock')

    variables.value = { a: '2' }
    await vi.advanceTimersByTimeAsync(500)

    expect(preview.error.value).toBe('templateId is required.')
    expect(preview.url.value).toBe('blob:mock')
    scope.stop()
  })
})