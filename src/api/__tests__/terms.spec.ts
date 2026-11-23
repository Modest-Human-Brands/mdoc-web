import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/config', () => ({ config: { apiBaseUrl: '', apiKey: '' } }))

import { termsApi } from '../terms'

afterEach(() => vi.unstubAllGlobals())

function stub(body: unknown) {
  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(Response.json(body)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('termsApi', () => {
  it('lists with the template and status filters', async () => {
    const fetchMock = stub([{ id: '1', slug: 'payment', title: 'Payment', status: 'Release' }])

    const [first] = await termsApi.list({ template: 'quotation', status: 'Release' })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/compliance?template=quotation&status=Release')
    expect(first).toMatchObject({ appliesTo: [], defaultFor: [], requiredFor: [], version: 1 })
  })

  it('updates metadata with PATCH and the content with PUT', async () => {
    const fetchMock = stub({ success: true, version: 4 })

    await termsApi.updateMeta('payment', { status: 'Release' }).catch(() => {})
    await termsApi.saveContent('payment', { type: 'doc' })

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ status: 'Release' }),
    })
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ content: { type: 'doc' } }),
    })
  })

  it('archives with DELETE and replaces a template default set with PUT', async () => {
    const fetchMock = stub({ status: 'Archive', templateId: 'invoice', slugs: ['a'] })

    await termsApi.archive('old term')
    await termsApi.setDefaults('invoice', ['a'])

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/compliance/old%20term')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/compliance/defaults/invoice')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ slugs: ['a'] }),
    })
  })
})