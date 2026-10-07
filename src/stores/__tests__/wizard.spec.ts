import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { CreateDocumentRequest, TemplateDetail } from '@/api'
import invoiceFixture from '@/test/fixtures/invoice.json'

import { useWizardStore } from '../wizard'

const invoice = invoiceFixture as unknown as TemplateDetail

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function readyInvoice() {
  const wizard = useWizardStore()
  wizard.selectTemplate('invoice')
  wizard.applyTemplate(invoice)
  wizard.organization.name = 'Modest Human Brands'
  wizard.setValue(['recipient', 'name'], 'Chai Theory Pvt Ltd')
  wizard.setValue(['recipient', 'address'], 'Mumbai')
  wizard.setValue(['recipient', 'email'], 'accounts@chaitheory.in')
  wizard.setValue(['recipient', 'phone'], '+91 98200 12345')
  wizard.setValue(['project', 'title'], 'Monsoon Masala ad film')
  wizard.setValue(['project', 'quoteNumber'], 'MHB-Q-26-009')
  wizard.setValue(['project', 'quoteDate'], '2026-09-25')
  wizard.setValue(['project', 'shootDate'], '2026-10-02')
  wizard.setValue(['project', 'shootLocation'], 'Mumbai')
  wizard.setValue(['project', 'deliverables', 0, 'title'], 'Ad film production')
  wizard.setValue(['project', 'deliverables', 0, 'description'], '30s master edit')
  wizard.setValue(['project', 'deliverables', 0, 'rate'], '1,20,000')
  wizard.setValue(['financials', 'discountValue'], '10')
  wizard.setValue(['financials', 'amountPaid'], '60,000')
  wizard.ids.userId = 'user-1'
  wizard.ids.contactId = 'contact-1'
  return wizard
}

describe('wizard store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies invoice defaults in the API field names without overwriting input', () => {
    const wizard = useWizardStore()
    wizard.selectTemplate('invoice')
    wizard.setValue(['financials', 'taxLabel'], 'VAT')
    wizard.applyTemplate(invoice)

    expect(wizard.values).toMatchObject({
      pricingModel: 'project',
      financials: { taxLabel: 'VAT', discountLabel: 'Discount', isDiscountPercentage: true },
      project: { deliverables: [{ quantity: '1' }] },
    })
    expect(wizard.schema?.properties).not.toHaveProperty('organization')
  })

  it('blocks creation until required fields and ids are filled, then unblocks', () => {
    const wizard = useWizardStore()
    wizard.selectTemplate('invoice')
    wizard.applyTemplate(invoice)

    const blocked = wizard.problems.map((p) => p.path)
    expect(blocked).toContain('recipient.name')
    expect(blocked).toContain('project.deliverables')
    expect(blocked).toContain('ids.userId')

    const ready = readyInvoice()
    expect(ready.problems.map((p) => p.message)).toEqual([])
    expect(ready.totals.amountDue).toBe(48000)
  })

  it('sends the preview complete nested objects plus the organizationId preset', () => {
    const wizard = useWizardStore()
    wizard.selectTemplate('invoice')
    wizard.applyTemplate(invoice)
    wizard.setValue(['recipient', 'name'], 'Alex')

    const vars = wizard.previewVariables

    expect(vars.organizationId).toBe('modest-human-brands')
    expect(vars).toHaveProperty('recipient.name', 'Alex')
    expect(vars).toHaveProperty('recipient.email')
    expect(vars).not.toHaveProperty('organization')
  })

  it('creates the document with typed ids, organizationId and a numeric payload', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        jsonResponse({ id: 'doc-1', templateId: 'invoice', name: 'MHB-I-26-001', sizeBytes: 10 }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const wizard = readyInvoice()

    const created = await wizard.createDocument()

    const [url, init] = fetchMock.mock.calls[0] ?? []
    const body = JSON.parse(init?.body as string) as CreateDocumentRequest
    expect(url).toBe('/api/document/template')
    expect(body).toMatchObject({
      template: 'invoice',
      userId: 'user-1',
      contactId: 'contact-1',
      organizationId: 'modest-human-brands',
    })
    expect(body.data).toMatchObject({
      pricingModel: 'project',
      project: { deliverables: [{ title: 'Ad film production', quantity: 1, rate: 120000 }] },
      financials: { discountValue: 10, isDiscountPercentage: true, amountPaid: 60000 },
    })
    expect(body.data).not.toHaveProperty('organization')
    expect(created.id).toBe('doc-1')
    expect(wizard.email.to).toBe('accounts@chaitheory.in')
    expect(wizard.email.message).toContain('₹48,000')
    expect(localStorage.getItem('mdoc.ids')).toContain('user-1')
  })

  it('keeps the server field errors so inputs can show them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(
          jsonResponse(
            {
              statusMessage: 'Bad Request',
              data: { errors: [{ field: 'recipient.email', message: 'Invalid recipient email' }] },
            },
            400,
          ),
        ),
      ),
    )
    const wizard = readyInvoice()

    await expect(wizard.createDocument()).rejects.toThrow('Invalid recipient email')
    expect(wizard.fieldErrors['recipient.email']).toBe('Invalid recipient email')

    wizard.setValue(['recipient', 'email'], 'fixed@example.com')
    expect(wizard.fieldErrors['recipient.email']).toBeUndefined()
  })

  it('invalidates the created document when the form changes afterwards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(jsonResponse({ id: 'd', templateId: 'invoice', name: 'n', sizeBytes: 1 })),
      ),
    )
    const wizard = readyInvoice()
    await wizard.createDocument()
    expect(wizard.document).not.toBeNull()

    wizard.setValue(['project', 'title'], 'Changed')
    await Promise.resolve()

    expect(wizard.document).toBeNull()
  })

  it('refuses to create without a template and resets cleanly', async () => {
    const wizard = useWizardStore()
    await expect(wizard.createDocument()).rejects.toThrow('Pick a template first.')

    const ready = readyInvoice()
    ready.reset()
    expect(ready.templateId).toBeNull()
    expect(ready.values).toEqual({})
  })
})