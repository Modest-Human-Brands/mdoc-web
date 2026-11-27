import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'

import type { CreateDocumentRequest, DocumentDetail, TemplateDetail } from '@/api'
import invoiceFixture from '@/test/fixtures/invoice.json'
import numbering from '@/test/fixtures/numbering.json'

import { useWizardStore } from '../wizard'

const invoice = invoiceFixture as unknown as TemplateDetail

function urlOf(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
}

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
  wizard.setValue(['project', 'invoiceNumber'], 'MHB-I-26-001')
  wizard.setValue(['financials', 'discountValue'], '10')
  wizard.setValue(['financials', 'isDiscountPercentage'], true)
  wizard.setValue(['financials', 'taxRate'], '0')
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

  it('fills the recipient from a chosen client and forgets the client with the template', () => {
    const wizard = useWizardStore()
    wizard.selectTemplate('invoice')
    wizard.applyTemplate(invoice)

    wizard.selectClient(
      { id: 'c1', name: 'Chai Theory', email: 'a@chai.in', phone: '+91 1', address: 'Mumbai' },
      ['name', 'address', 'email', 'phone'],
    )

    expect(wizard.clientId).toBe('c1')
    expect(wizard.values.recipient).toMatchObject({
      name: 'Chai Theory',
      email: 'a@chai.in',
      phone: '+91 1',
      address: 'Mumbai',
    })

    wizard.selectTemplate('quotation')
    expect(wizard.clientId).toBeNull()
  })

  it('applies server defaults from the schema without overwriting input', () => {
    const wizard = useWizardStore()
    wizard.selectTemplate('invoice')
    wizard.setValue(['financials', 'taxLabel'], 'VAT')
    wizard.applyTemplate(invoice)

    expect(wizard.values).toMatchObject({
      pricingModel: 'project',
      financials: {
        taxLabel: 'VAT',
        taxRate: '18',
        discountLabel: 'Discount',
        discountValue: '0',
        isDiscountPercentage: false,
        amountPaid: '0',
      },
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

  it('sends the draft preview only what was typed, with no organisation data', () => {
    const wizard = useWizardStore()
    wizard.selectTemplate('invoice')
    wizard.applyTemplate(invoice)
    wizard.setValue(['recipient', 'name'], 'Alex')

    const vars = wizard.previewVariables

    expect(vars).not.toHaveProperty('organizationId')
    expect(vars).not.toHaveProperty('organization')
    expect(vars).toHaveProperty('recipient.name', 'Alex')
    expect(vars).not.toHaveProperty('recipient.email')
    expect(vars).not.toHaveProperty('organization')
  })

  it('shows draft-preview warnings only for fields that hold a value', () => {
    const wizard = useWizardStore()
    wizard.selectTemplate('invoice')
    wizard.applyTemplate(invoice)
    wizard.setValue(['recipient', 'name'], 'Alex')
    wizard.setValue(['recipient', 'phone'], '12')

    wizard.setPreviewWarnings([
      { field: 'recipient.address', message: 'Invalid input: expected string, received undefined' },
      { field: 'recipient.phone', message: 'Too short for this server' },
    ])

    expect(wizard.previewHints).toEqual({ 'recipient.phone': 'Too short for this server' })
    expect(wizard.fieldErrors['recipient.address']).toBeUndefined()
    expect(wizard.fieldErrors['recipient.phone']).toBe('Too short for this server')
  })

  it('creates the document with typed ids, the x-org-id header and a numeric payload', async () => {
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
    })
    expect(body).not.toHaveProperty('organizationId')
    expect(init?.headers).toMatchObject({ 'x-org-id': 'modest-human-brands' })
    expect(body.data).not.toHaveProperty('organization')
    expect(body.data).toMatchObject({
      pricingModel: 'project',
      project: { deliverables: [{ title: 'Ad film production', quantity: 1, rate: 120000 }] },
      financials: { discountValue: 10, isDiscountPercentage: true, amountPaid: 60000 },
    })
    expect(body.data).not.toHaveProperty('organization')
    expect(created.id).toBe('doc-1')
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

  it('loadTemplate: an unknown template leaves the wizard untouched and usable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        Promise.resolve(jsonResponse({ statusMessage: "Template 'nope' not found." }, 404)),
      ),
    )
    const wizard = useWizardStore()
    wizard.selectTemplate('invoice')
    wizard.applyTemplate(invoice)
    wizard.setValue(['recipient', 'name'], 'Keep me')

    await expect(wizard.loadTemplate('nope')).rejects.toThrow("Template 'nope' not found.")

    expect(wizard.templateId).toBe('invoice')
    expect(wizard.template?.id).toBe('invoice')
    expect(wizard.values).toMatchObject({ recipient: { name: 'Keep me' } })
  })

  it('shows constraint errors inline and blocks creation until they are fixed', () => {
    const wizard = readyInvoice()
    wizard.setValue(['recipient', 'email'], 'acc')

    expect(wizard.clientErrors['recipient.email']).toBe('Enter a valid email address')
    expect(wizard.fieldErrors['recipient.email']).toBeDefined()
    expect(wizard.problems.map((p) => p.path)).toContain('recipient.email')

    wizard.setValue(['recipient', 'email'], 'a@b.in')
    expect(wizard.clientErrors['recipient.email']).toBeUndefined()
    expect(wizard.problems).toEqual([])
  })

  describe('server numbering', () => {
    function stubNumbering(numberingStatus = 200) {
      const fetchMock = vi.fn<typeof fetch>((input) => {
        const url = urlOf(input)
        if (url.includes('/document/numbering/next')) {
          return Promise.resolve(
            numberingStatus === 200
              ? jsonResponse(numbering)
              : jsonResponse({ statusMessage: 'Numbering unavailable' }, numberingStatus),
          )
        }
        return Promise.resolve(jsonResponse(invoice))
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    it('fills the invoice number from the server and locks the field', async () => {
      const fetchMock = stubNumbering()
      const wizard = useWizardStore()

      await wizard.loadTemplate('invoice')

      expect(wizard.values).toMatchObject({ project: { invoiceNumber: 'MHB-I-26-001' } })
      expect(wizard.isAutoLocked('project.invoiceNumber')).toBe(true)
      expect(wizard.isAutoLocked('project.quoteNumber')).toBe(false)
      const numberingUrl = urlOf(
        fetchMock.mock.calls.find(([u]) => urlOf(u).includes('numbering'))?.[0] as string,
      )
      expect(numberingUrl).toContain('templateId=invoice')
      expect(numberingUrl).not.toContain('organizationId=')
      const numberingInit = fetchMock.mock.calls.find(([u]) => urlOf(u).includes('numbering'))?.[1]
      expect(numberingInit?.headers).toMatchObject({ 'x-org-id': 'modest-human-brands' })
      expect(numberingUrl).not.toContain('organizationName=')
    })

    it('leaves the field editable when numbering fails', async () => {
      stubNumbering(500)
      const wizard = useWizardStore()

      await wizard.loadTemplate('invoice')

      expect(wizard.isAutoLocked('project.invoiceNumber')).toBe(false)
      expect(wizard.numberError).toBe('Numbering unavailable')
      wizard.setValue(['project', 'invoiceNumber'], 'MANUAL-1')
      expect(wizard.values).toMatchObject({ project: { invoiceNumber: 'MANUAL-1' } })
    })

    it('names the created document after the number', async () => {
      const fetchMock = stubNumbering()
      const wizard = await (async () => {
        const w = useWizardStore()
        await w.loadTemplate('invoice')
        return w
      })()
      fetchMock.mockImplementation((input) => {
        const url = urlOf(input)
        return Promise.resolve(
          url.endsWith('/document/template')
            ? jsonResponse({ id: 'd', templateId: 'invoice', name: 'MHB-I-26-001', sizeBytes: 1 })
            : jsonResponse(invoice),
        )
      })
      wizard.setValue(['recipient', 'name'], 'A')
      wizard.setValue(['recipient', 'address'], 'B')
      wizard.setValue(['recipient', 'email'], 'a@b.in')
      wizard.setValue(['recipient', 'phone'], '1')
      wizard.setValue(['project', 'title'], 'T')
      wizard.setValue(['project', 'quoteNumber'], 'Q')
      wizard.setValue(['project', 'quoteDate'], '2026-09-25')
      wizard.setValue(['project', 'shootDate'], '2026-10-02')
      wizard.setValue(['project', 'shootLocation'], 'Mumbai')
      wizard.setValue(['project', 'deliverables', 0, 'title'], 'Ad film')
      wizard.ids.userId = 'u'
      wizard.ids.contactId = 'c'

      await wizard.createDocument()

      const createCall = fetchMock.mock.calls.find(([u]) => urlOf(u).endsWith('/document/template'))
      const body = JSON.parse(createCall?.[1]?.body as string) as CreateDocumentRequest
      expect(body.name).toBe('MHB-I-26-001')
    })
  })

  describe('organisation in Notion', () => {
    const record = (name = 'ZZZ Studio', revision = 'r1') => ({
      pageId: 'page-1',
      revision,
      organization: {
        id: 'zzz',
        name,
        contactEmail: 'a@zzz.in',
        branding: { color: { primary: '#111827', accent: '#5945EA' }, font: 'Exo2' },
      },
    })

    function stubApi(...responses: Response[]) {
      const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(responses.shift() as Response))
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    const bodyOf = (init: RequestInit | undefined) =>
      JSON.parse(init?.body as string) as Record<string, unknown>

    it('loads the record from the API and keeps nothing in this browser', async () => {
      const fetchMock = stubApi(jsonResponse(record()))
      localStorage.setItem('mdoc.organization', JSON.stringify({ name: 'Old local copy' }))
      const wizard = useWizardStore()

      await wizard.ensureOrganization()
      await wizard.ensureOrganization()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(urlOf(fetchMock.mock.calls[0]?.[0] as string)).toBe('/api/organization')
      expect(wizard.organization.name).toBe('ZZZ Studio')
      expect(wizard.organizationSaved).toBe(true)
      expect(wizard.previewVariables).not.toHaveProperty('organization')
    })

    it('reports a failed load and refuses to save over a record it never read', async () => {
      const fetchMock = stubApi(
        jsonResponse({ data: { errors: [{ field: 'x-user-id', message: 'Not a member' }] } }, 403),
      )
      const wizard = useWizardStore()

      expect(await wizard.ensureOrganization()).toBe(false)
      wizard.organization.name = 'Typed anyway'

      expect(wizard.organizationError).toBe('Not a member')
      expect(await wizard.saveOrganizationProfile()).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('saves only the changed fields, with the revision they were based on', async () => {
      const fetchMock = stubApi(jsonResponse(record()), jsonResponse(record('New name', 'r2')))
      const wizard = useWizardStore()
      await wizard.ensureOrganization()
      wizard.organization.name = 'New name'
      expect(wizard.previewVariables).toMatchObject({ organization: { name: 'New name' } })

      expect(await wizard.saveOrganizationProfile()).toBe(true)

      const init = fetchMock.mock.calls[1]?.[1]
      expect(init?.method).toBe('PATCH')
      expect(bodyOf(init)).toEqual({ revision: 'r1', name: 'New name' })
      expect(wizard.organizationRevision).toBe('r2')
      expect(wizard.organizationSaved).toBe(true)
      expect(localStorage.getItem('mdoc.organization')).toBeNull()
    })

    it('keeps the edits when Notion changed in the meantime', async () => {
      stubApi(
        jsonResponse(record()),
        jsonResponse({ data: { errors: [{ field: 'revision', message: 'Changed' }] } }, 409),
      )
      const wizard = useWizardStore()
      await wizard.ensureOrganization()
      wizard.organization.name = 'Mine'

      expect(await wizard.saveOrganizationProfile()).toBe(false)

      expect(wizard.organizationError).toBe('Changed')
      expect(wizard.organization.name).toBe('Mine')
      expect(wizard.organizationSaved).toBe(false)

      wizard.discardOrganizationChanges()
      expect(wizard.organization.name).toBe('ZZZ Studio')
      expect(wizard.organizationSaved).toBe(true)
    })

    it('creates a document without any organisation data', async () => {
      const fetchMock = stubApi(
        jsonResponse({ id: 'd', templateId: 'invoice', name: 'n', sizeBytes: 1 }),
      )
      const wizard = readyInvoice()

      await wizard.createDocument()

      const body = bodyOf(fetchMock.mock.calls[0]?.[1])
      expect(body).not.toHaveProperty('organizationId')
      expect(body.data).not.toHaveProperty('organization')
    })

    it('will not create a document while brand changes are unsaved', async () => {
      const fetchMock = stubApi()
      const wizard = readyInvoice()
      wizard.organization.name = 'Unsaved'

      await expect(wizard.createDocument()).rejects.toThrow('Save or discard your brand changes')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('editing a draft', () => {
    const draftDocument = (rawData: Record<string, unknown>): DocumentDetail =>
      ({
        id: 'doc-1',
        name: 'MHB-I-26-001',
        status: 'Draft',
        templateId: 'invoice',
        rawData,
        revision: 'r1',
      }) as unknown as DocumentDetail

    const savedData = {
      recipient: { name: 'Saved Client', address: 'Pune', gstin: '27ABCDE1234F1Z5' },
      project: { title: 'Saved shoot', invoiceNumber: 'MHB-I-26-001' },
      memo: 'sent through the API',
      organization: { name: 'Old branding' },
    }

    it('opens the saved values with the number locked and nothing to save', () => {
      const wizard = useWizardStore()
      wizard.startEditing(draftDocument(savedData), invoice)

      expect(wizard.values).toMatchObject({ recipient: { name: 'Saved Client' } })
      expect(wizard.isAutoLocked('project.invoiceNumber')).toBe(true)
      expect(wizard.hasUnsavedEdits).toBe(false)
      expect(wizard.problems.map((p) => p.path)).not.toContain('ids.contactId')
      expect(wizard.previewVariables).toMatchObject({ memo: 'sent through the API' })
      expect(wizard.previewVariables).not.toHaveProperty('organization')
    })

    it('does not let the template change', async () => {
      const wizard = useWizardStore()
      wizard.startEditing(draftDocument(savedData), invoice)

      wizard.selectTemplate('quotation')

      expect(wizard.templateId).toBe('invoice')
      await expect(wizard.loadTemplate('quotation')).rejects.toThrow('template cannot be changed')
      await expect(wizard.createDocument()).rejects.toThrow('A saved document is open')
    })

    it('sends the data with its revision, without a template or organisation', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: 'doc-1' }))
      vi.stubGlobal('fetch', fetchMock)
      const wizard = useWizardStore()
      wizard.startEditing(draftDocument(savedData), invoice)
      wizard.setValue(['recipient', 'name'], 'Renamed Client')
      expect(wizard.hasUnsavedEdits).toBe(true)

      await wizard.saveDocumentEdits()

      const [input, init] = fetchMock.mock.calls[0]!
      expect(urlOf(input)).toMatch(/\/api\/document\/doc-1$/)
      expect(init?.method).toBe('PUT')
      const body = JSON.parse(init?.body as string) as { data: Record<string, unknown> }
      expect(Object.keys(body).sort()).toEqual(['data', 'revision'])
      expect(body).toMatchObject({
        revision: 'r1',
        data: {
          recipient: { name: 'Renamed Client', gstin: '27ABCDE1234F1Z5' },
          memo: 'sent through the API',
        },
      })
      expect(body.data).not.toHaveProperty('organization')
      expect(wizard.editing).toBeNull()
    })

    it('stays open with the edits when the server refuses them', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            jsonResponse({ data: { errors: [{ field: 'status', message: 'Not a Draft' }] } }, 403),
          ),
      )
      const wizard = useWizardStore()
      wizard.startEditing(draftDocument(savedData), invoice)
      wizard.setValue(['recipient', 'name'], 'Kept')

      await expect(wizard.saveDocumentEdits()).rejects.toThrow('Not a Draft')

      expect(wizard.editing?.id).toBe('doc-1')
      expect(wizard.values).toMatchObject({ recipient: { name: 'Kept' } })
    })

    it('leaves the unfinished new document as it was', async () => {
      const wizard = readyInvoice()
      await nextTick()
      const stored = localStorage.getItem('mdoc.draft')

      wizard.startEditing(draftDocument(savedData), invoice)
      wizard.setValue(['recipient', 'name'], 'Edited')
      await nextTick()
      expect(localStorage.getItem('mdoc.draft')).toBe(stored)

      wizard.stopEditing()
      expect(wizard.values).toMatchObject({ recipient: { name: 'Chai Theory Pvt Ltd' } })
      expect(wizard.templateId).toBe('invoice')
    })

    it('clears everything on reset, including the set-aside draft', async () => {
      const wizard = readyInvoice()
      wizard.startEditing(draftDocument(savedData), invoice)

      wizard.reset()
      await nextTick()

      expect(wizard.editing).toBeNull()
      expect(wizard.templateId).toBeNull()
      expect(wizard.document).toBeNull()
      expect(wizard.values).toEqual({})
    })
  })
})