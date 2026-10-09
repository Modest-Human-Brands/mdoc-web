import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { clearTemplateCache, type CreateDocumentRequest, type TemplateDetail } from '@/api'
import invoiceFixture from '@/test/fixtures/invoice.json'
import numberingFixture from '@/test/fixtures/numbering.json'
import templatesFixture from '@/test/fixtures/templates.json'
import { useWizardStore } from '@/stores/wizard'

import { registerWebMcp } from '../register'
import { createTools, type ToolDeps } from '../tools'
import type { ModelContextTool, ToolResult } from '../types'

const invoice = invoiceFixture as unknown as TemplateDetail

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function data<T = Record<string, unknown>>(result: ToolResult): T {
  return JSON.parse(result.content[0]?.text ?? '{}') as T
}

function setup(confirm = vi.fn<ToolDeps['confirm']>(() => Promise.resolve(true))) {
  const wizard = useWizardStore()
  const route = { path: '/new/details' }
  const push = vi.fn<(to: string) => Promise<void>>((to) => {
    route.path = to
    return Promise.resolve()
  })
  const router = { push, currentRoute: { value: route } } as unknown as ToolDeps['router']
  const tools = createTools({ wizard, router, confirm })
  const call = (name: string, args: Record<string, unknown> = {}): Promise<ToolResult> => {
    const found = tools.find((t) => t.name === name) as ModelContextTool
    return found.execute(args)
  }
  return { wizard, call, push, confirm, tools }
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fn = vi.fn<typeof fetch>((input, init) =>
    Promise.resolve(
      handler(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        init,
      ),
    ),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('WebMCP tools', () => {
  beforeEach(() => {
    localStorage.clear()
    clearTemplateCache()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function withInvoice() {
    const ctx = setup()
    ctx.wizard.selectTemplate('invoice')
    ctx.wizard.applyTemplate(invoice)
    return ctx
  }

  it('exposes read-only and action tools with descriptions and schemas', () => {
    const { tools } = setup()
    const names = tools.map((t) => t.name)

    expect(names).toEqual(
      expect.arrayContaining([
        'get_wizard_state',
        'list_templates',
        'get_template_schema',
        'validate_form',
        'select_template',
        'set_fields',
        'add_row',
        'create_document',
      ]),
    )
    expect(tools.find((t) => t.name === 'get_wizard_state')?.annotations?.readOnlyHint).toBe(true)
    expect(tools.find((t) => t.name === 'create_document')?.annotations?.readOnlyHint).toBe(false)
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20)
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('lists templates with categories', async () => {
    stubFetch(() => json(templatesFixture))
    const { call } = setup()

    const result = data<{ id: string; category: string; shortLabel: string }[]>(
      await call('list_templates'),
    )

    expect(result).toHaveLength(6)
    expect(result.find((t) => t.id === 'invoice')).toMatchObject({
      category: 'Billing',
      shortLabel: 'Invoice',
    })
  })

  it('selects a template, loads its schema and reports what is missing', async () => {
    stubFetch(() => json(invoice))
    const { wizard, call } = setup()

    const result = data<{ selected: { id: string }; missing: { path: string }[] }>(
      await call('select_template', { templateId: 'invoice' }),
    )

    expect(result.selected.id).toBe('invoice')
    expect(wizard.schema).not.toBeNull()
    expect(result.missing.map((p) => p.path)).toContain('recipient.name')
  })

  it('returns the schema without the server-resolved organization', async () => {
    stubFetch(() => json(invoice))
    const { call } = setup()

    const result = data<{ schema: { properties: Record<string, unknown> } }>(
      await call('get_template_schema', { templateId: 'invoice' }),
    )

    expect(Object.keys(result.schema.properties)).toContain('recipient')
    expect(Object.keys(result.schema.properties)).not.toContain('organization')
  })

  it('set_fields applies valid paths, coercing numbers and booleans', async () => {
    const { wizard, call } = await withInvoice()

    const result = await call('set_fields', {
      fields: {
        'recipient.name': 'Chai Theory',
        'project.deliverables.0.rate': 120000,
        'financials.isDiscountPercentage': 'yes',
        pricingModel: 'DAY',
        dueDate: '2026-10-14',
      },
    })

    expect(result.isError).toBeUndefined()
    expect(wizard.values).toMatchObject({
      recipient: { name: 'Chai Theory' },
      pricingModel: 'day',
      dueDate: '2026-10-14',
      financials: { isDiscountPercentage: true },
      project: { deliverables: [{ rate: '120000' }] },
    })
  })

  it('set_fields is all-or-nothing and lists valid paths on errors', async () => {
    const { wizard, call } = await withInvoice()
    const before = JSON.stringify(wizard.values)

    const result = await call('set_fields', {
      fields: {
        'recipient.name': 'Alex',
        'recipient.nope': 'x',
        pricingModel: 'weekly',
        dueDate: '14/10/2026',
        'project.deliverables.3.title': 'x',
      },
    })

    const body = data<{ errors: string[]; validPaths: string[] }>(result)
    expect(result.isError).toBe(true)
    expect(body.errors).toHaveLength(4)
    expect(body.errors.join(' ')).toContain('unknown field "nope"')
    expect(body.errors.join(' ')).toContain('one of: project, day')
    expect(body.errors.join(' ')).toContain('YYYY-MM-DD')
    expect(body.errors.join(' ')).toContain('add_row')
    expect(body.validPaths).toContain('recipient.email')
    expect(JSON.stringify(wizard.values)).toBe(before)
  })

  it('adds and removes list rows, keeping at least one', async () => {
    const { wizard, call } = await withInvoice()

    await call('add_row', { path: 'project.deliverables' })
    await call('set_fields', { fields: { 'project.deliverables.1.title': 'Edit' } })
    expect((wizard.values.project as { deliverables: unknown[] }).deliverables).toHaveLength(2)

    await call('remove_row', { path: 'project.deliverables', index: 0 })
    expect(
      (wizard.values.project as { deliverables: { title: string }[] }).deliverables[0]?.title,
    ).toBe('Edit')

    const last = await call('remove_row', { path: 'project.deliverables', index: 0 })
    expect(last.isError).toBe(true)
  })

  it('validate_form mirrors the required fields until everything is filled', async () => {
    const { call } = await withInvoice()

    const blocked = data<{ ready: boolean; problems: { path: string }[] }>(
      await call('validate_form'),
    )
    expect(blocked.ready).toBe(false)
    expect(blocked.problems.map((p) => p.path)).toContain('ids.userId')

    await call('set_owner_ids', { userId: 'u1', contactId: 'c1' })
    await call('set_fields', {
      fields: {
        'recipient.name': 'A',
        'recipient.address': 'B',
        'recipient.email': 'a@b.in',
        'recipient.phone': '1',
        'project.title': 'T',
        'project.quoteNumber': 'Q',
        'project.quoteDate': '2026-09-25',
        'project.shootDate': '2026-10-02',
        'project.shootLocation': 'Mumbai',
        'project.invoiceNumber': 'MHB-I-26-001',
        'project.deliverables.0.title': 'Ad film',
      },
    })
    const ready = data<{ ready: boolean }>(await call('validate_form'))
    expect(ready.ready).toBe(true)
  })

  it('select_template with an unknown id leaves no half-selected template behind', async () => {
    stubFetch((url) =>
      url.endsWith('/nope')
        ? json({ statusMessage: "Template 'nope' not found." }, 404)
        : json(invoice),
    )
    const { wizard, call } = setup()

    const bad = await call('select_template', { templateId: 'nope' })
    expect(bad.isError).toBe(true)
    expect(wizard.templateId).toBeNull()
    expect(data<{ template: unknown }>(await call('get_wizard_state')).template).toBeNull()

    const good = await call('select_template', { templateId: 'invoice' })
    expect(good.isError).toBeUndefined()
    expect((await call('add_row', { path: 'project.deliverables' })).isError).toBeUndefined()
  })

  it('set_fields rejects a malformed email and a negative quantity without changing anything', async () => {
    const { wizard, call } = await withInvoice()
    const before = JSON.stringify(wizard.values)

    const result = await call('set_fields', {
      fields: { 'recipient.email': 'bad', 'project.deliverables.0.quantity': -2 },
    })

    const body = data<{ errors: string[] }>(result)
    expect(result.isError).toBe(true)
    expect(body.errors.join(' ')).toContain('Enter a valid email address')
    expect(body.errors.join(' ')).toContain('Must be at least 0')
    expect(JSON.stringify(wizard.values)).toBe(before)
  })

  it('validate_form flags an invalid value that was typed in the UI', async () => {
    const { wizard, call } = await withInvoice()
    wizard.setValue(['recipient', 'email'], 'acc')

    const result = data<{ problems: { path: string; kind: string }[] }>(await call('validate_form'))

    expect(result.problems.find((p) => p.path === 'recipient.email')?.kind).toBe('invalid')
  })

  it('set_fields refuses the server-generated number but allows editable references', async () => {
    stubFetch((url) =>
      url.includes('/document/numbering/next') ? json(numberingFixture) : json(invoice),
    )
    const { wizard, call } = setup()
    await call('select_template', { templateId: 'invoice' })
    expect(wizard.values).toMatchObject({ project: { invoiceNumber: 'MHB-I-26-001' } })

    const blocked = await call('set_fields', { fields: { 'project.invoiceNumber': 'HACK-1' } })
    const allowed = await call('set_fields', { fields: { 'project.quoteNumber': 'MHB-Q-26-009' } })

    expect(blocked.isError).toBe(true)
    expect(data<{ errors: string[] }>(blocked).errors[0]).toContain('generated by the server')
    expect(wizard.values).toMatchObject({ project: { invoiceNumber: 'MHB-I-26-001' } })
    expect(allowed.isError).toBeUndefined()
  })

  it('go_to_step reports router redirects', async () => {
    const { call, push } = setup()
    push.mockImplementation(() => Promise.resolve())

    const result = data<{ redirected: boolean; step: string }>(
      await call('go_to_step', { step: 'review' }),
    )

    expect(result.redirected).toBe(true)
    expect(result.step).toBe('details')
  })

  it('set_organization only accepts known keys and valid entity types', async () => {
    const { wizard, call } = setup()

    expect((await call('set_organization', { colour: 'red' })).isError).toBe(true)
    expect((await call('set_organization', { entityType: 'Charity' })).isError).toBe(true)

    await call('set_organization', { id: 'acme', entityType: 'llp' })
    expect(wizard.organization).toMatchObject({ id: 'acme', entityType: 'LLP' })
    expect(localStorage.getItem('mdoc.organization')).toContain('acme')
  })

  it('set_organization validates colours, font and emails, all or nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(json([{ family: 'Poppins', name: 'Poppins' }]))),
    )
    const { wizard, call } = setup()
    const before = JSON.stringify(wizard.organization)

    const bad = await call('set_organization', {
      id: 'changed',
      primary: 'notacolor',
      font: 'Comic Sans',
      billingEmail: 'nope',
    })

    const body = data<{ errors: string[] }>(bad)
    expect(bad.isError).toBe(true)
    expect(body.errors).toHaveLength(3)
    expect(body.errors.join(' ')).toContain('#5945EA')
    expect(JSON.stringify(wizard.organization)).toBe(before)

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(json([{ family: 'Poppins', name: 'Poppins' }]))),
    )
    const good = await call('set_organization', {
      primary: '#abc',
      accent: '#5945ea',
      font: 'poppins',
    })
    expect(good.isError).toBeUndefined()
    expect(wizard.organization).toMatchObject({
      primary: '#AABBCC',
      accent: '#5945EA',
      font: 'Poppins',
    })
  })

  describe('create_document', () => {
    async function ready(confirm?: ToolDeps['confirm']) {
      const ctx = setup(confirm ? vi.fn<ToolDeps['confirm']>(confirm) : undefined)
      ctx.wizard.selectTemplate('invoice')
      ctx.wizard.applyTemplate(invoice)
      await ctx.call('set_owner_ids', { userId: 'u1', contactId: 'c1' })
      await ctx.call('set_fields', {
        fields: {
          'recipient.name': 'Chai Theory',
          'recipient.address': 'Mumbai',
          'recipient.email': 'accounts@chaitheory.in',
          'recipient.phone': '1',
          'project.title': 'Monsoon Masala',
          'project.quoteNumber': 'Q',
          'project.quoteDate': '2026-09-25',
          'project.shootDate': '2026-10-02',
          'project.shootLocation': 'Mumbai',
          'project.invoiceNumber': 'MHB-I-26-001',
          'project.deliverables.0.title': 'Ad film',
          'project.deliverables.0.rate': 120000,
        },
      })
      return ctx
    }

    it('refuses while the form is incomplete', async () => {
      const { call, confirm } = await withInvoice()

      const result = await call('create_document')

      expect(result.isError).toBe(true)
      expect(confirm).not.toHaveBeenCalled()
    })

    it('does nothing when the user declines', async () => {
      const fetchMock = stubFetch(() => json({}))
      const { call, confirm } = await ready(() => Promise.resolve(false))

      const result = await call('create_document')

      expect(confirm).toHaveBeenCalledTimes(1)
      expect(result.isError).toBe(true)
      expect(data<{ error: string }>(result).error).toContain('declined')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('creates the document after confirmation and returns a download link', async () => {
      const fetchMock = stubFetch(() =>
        json({ id: 'doc-1', templateId: 'invoice', name: 'MHB-I-26-001', sizeBytes: 123 }),
      )
      const { call, push } = await ready()

      const result = data<{ documentId: string; downloadUrl: string }>(
        await call('create_document'),
      )

      const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as CreateDocumentRequest
      expect(body).toMatchObject({ template: 'invoice', userId: 'u1', contactId: 'c1' })
      expect(body.data).toMatchObject({
        recipient: { name: 'Chai Theory' },
        project: { deliverables: [{ title: 'Ad film', rate: 120000 }] },
      })
      expect(result.documentId).toBe('doc-1')
      expect(result.downloadUrl).toMatch(/\/api\/document\/doc-1\/content\?download=true$/)
      expect(push).toHaveBeenCalledWith('/new/review')
    })

    it('surfaces server field errors', async () => {
      stubFetch(() =>
        json(
          {
            statusMessage: 'Bad Request',
            data: { errors: [{ field: 'recipient.email', message: 'Invalid recipient email' }] },
          },
          400,
        ),
      )
      const { call } = await ready()

      const result = await call('create_document')

      expect(result.isError).toBe(true)
      expect(data<{ fieldErrors: { field: string }[] }>(result).fieldErrors[0]?.field).toBe(
        'recipient.email',
      )
    })
  })
})

describe('registerWebMcp', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    delete window.__mdocTools
    Reflect.deleteProperty(document, 'modelContext')
  })

  function deps() {
    const route = { path: '/new/template' }
    const router = {
      push: vi.fn<(to: string) => Promise<void>>(() => Promise.resolve()),
      currentRoute: { value: route },
    } as unknown as ToolDeps['router']
    return { wizard: useWizardStore(), router }
  }

  it('works without WebMCP support through window.__mdocTools', async () => {
    registerWebMcp(deps())

    expect(window.__mdocTools?.list().map((t) => t.name)).toContain('get_wizard_state')
    const state = await window.__mdocTools?.call('get_wizard_state')
    expect(data<{ step: string }>(state as ToolResult).step).toBe('template')

    const unknown = await window.__mdocTools?.call('nope')
    expect(unknown?.isError).toBe(true)
  })

  it('registers every tool through vueuse useWebMCP when document.modelContext exists', () => {
    const registerTool = vi.fn<(tool: ModelContextTool) => void>()
    Object.defineProperty(document, 'modelContext', { value: { registerTool }, configurable: true })

    registerWebMcp(deps())

    expect(registerTool).toHaveBeenCalledTimes(window.__mdocTools?.list().length ?? -1)
    expect(registerTool.mock.calls[0]?.[0]).toMatchObject({
      name: expect.any(String) as string,
      description: expect.any(String) as string,
      execute: expect.any(Function) as () => void,
    })
  })

  it('does not throw when a registration fails', () => {
    const registerTool = vi.fn<(tool: ModelContextTool) => void>(() => {
      throw new Error('duplicate')
    })
    Object.defineProperty(document, 'modelContext', { value: { registerTool }, configurable: true })

    expect(() => registerWebMcp(deps())).not.toThrow()
    expect(window.__mdocTools).toBeDefined()
  })
})