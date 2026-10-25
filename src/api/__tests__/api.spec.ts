import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { ApiError, documentsApi, resolveApiUrl, signingApi, templatesApi } from '@/api'

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('lists templates from GET /api/document/template', async () => {
    const fetchMock = mockFetch(200, [{ id: 'quotation', label: 'Quotation', description: 'd' }])

    const result = await templatesApi.list()

    expect(result[0]?.id).toBe('quotation')
    expect(fetchMock).toHaveBeenCalledWith('/api/document/template', expect.objectContaining({}))
  })

  it('posts JSON when creating a document', async () => {
    const fetchMock = mockFetch(200, { id: '1', templateId: 't', name: 'n', sizeBytes: 3 })

    await templatesApi.createDocument({
      name: 'n',
      template: 't',
      userId: 'u',
      contactId: 'c',
      data: { a: 1 },
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/document/template')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init?.body as string)).toMatchObject({ userId: 'u', data: { a: 1 } })
  })

  it('maps H3 error bodies to ApiError', async () => {
    mockFetch(403, { statusCode: 403, statusMessage: 'Document is locked.' })

    await expect(documentsApi.update('d1', { name: 'x' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Document is locked.',
    })
  })

  it('exposes field-level validation errors and summarises them', async () => {
    mockFetch(400, {
      statusMessage: 'Bad Request',
      data: {
        errors: [
          { field: 'recipient.email', message: 'Invalid recipient email', code: 'invalid_format' },
          { field: 'startDate', message: 'Invalid input', code: 'invalid_type' },
        ],
      },
    })

    const error = await templatesApi
      .preview({ templateId: 't', variables: {} })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('Invalid recipient email (+1 more)')
    expect((error as ApiError).fields.map((f) => f.field)).toEqual(['recipient.email', 'startDate'])
  })

  it('turns network failures into a friendly ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Failed to fetch'))),
    )

    const error = await templatesApi.list().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(0)
  })

  it('encodes ids, query params and content URLs', async () => {
    const fetchMock = mockFetch(200, { results: [], pagination: { total: 0, limit: 5, offset: 0 } })

    await documentsApi.list({ limit: 5, offset: 0 })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/document?limit=5&offset=0')
    expect(documentsApi.contentUrl('a b', { download: true })).toBe(
      '/api/document/a%20b/content?download=true',
    )
  })

  it('sends the PDF as multipart form data for signature verification', async () => {
    const fetchMock = mockFetch(200, { isIntact: true, signer: 's', message: 'ok' })

    await signingApi.verifySignature('d1', new Blob(['%PDF'], { type: 'application/pdf' }))

    const init = fetchMock.mock.calls[0]?.[1]
    const form = init?.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.has('pdf')).toBe(true)
  })

  it('resolves server-relative sample URLs and leaves absolute ones alone', () => {
    expect(resolveApiUrl('/api/document/template/invoice/sample.pdf')).toBe(
      '/api/document/template/invoice/sample.pdf',
    )
    expect(resolveApiUrl('https://cdn.example.com/a.pdf')).toBe('https://cdn.example.com/a.pdf')
  })

  it('peeks the next document number with the organisation context', async () => {
    const fetchMock = mockFetch(200, {
      templateId: 'invoice',
      prefix: 'MHB-I-26',
      sequence: 1,
      number: 'MHB-I-26-001',
    })

    const result = await documentsApi.nextNumber({
      templateId: 'invoice',
      organizationId: 'modest-human-brands',
      organizationName: 'Modest Human Brands',
    })

    expect(result.number).toBe('MHB-I-26-001')
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/document/numbering/next?templateId=invoice&organizationName=Modest+Human+Brands',
    )
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ 'x-org-id': 'modest-human-brands' })
  })

  it('keeps a Notion organisation id in the body instead of the x-org-id header', async () => {
    const id = '307ee3b0-289a-8116-afb0-f6a1795a27a0'
    const fetchMock = mockFetch(200, { id: '1', templateId: 't', name: 'n', sizeBytes: 3 })

    await templatesApi.createDocument({
      name: 'n',
      template: 't',
      userId: 'u',
      contactId: 'c',
      organizationId: id,
      data: {},
    })

    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init?.body as string)).toMatchObject({ organizationId: id })
  })

  it('explains a 401 as a rejected API key', async () => {
    mockFetch(401, {
      error: true,
      status: 401,
      data: { errors: [{ field: 'x-api-key', message: 'A valid x-api-key header is required.' }] },
    })

    await expect(documentsApi.get('d1')).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('API key'),
    })
  })
})