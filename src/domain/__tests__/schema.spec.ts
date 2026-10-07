import { describe, expect, it } from 'vite-plus/test'

import type { JsonSchema, TemplateDetail } from '@/api'
import invoiceFixture from '@/test/fixtures/invoice.json'
import internshipFixture from '@/test/fixtures/internship-completion-certificate.json'

import {
  emptyValue,
  getPath,
  missingRequired,
  orderedProperties,
  overlay,
  previewPayload,
  sampleValue,
  setPath,
  stripExcluded,
  toPayload,
  withDefaults,
  type Values,
} from '../schema'

const invoice = (invoiceFixture as unknown as TemplateDetail).schema
const internship = (internshipFixture as unknown as TemplateDetail).schema

describe('real server schemas', () => {
  it('orders properties by x-order', () => {
    expect(orderedProperties(invoice).map(([key]) => key)).toEqual([
      'recipient',
      'pricingModel',
      'project',
      'financials',
      'dueDate',
      'organization',
    ])
  })

  it('excludes the server-resolved organization from the form', () => {
    expect(Object.keys(stripExcluded(invoice).properties ?? {})).not.toContain('organization')
    expect(stripExcluded(invoice).required).not.toContain('organization')
  })

  it('builds blank state with one empty deliverable row', () => {
    const blank = emptyValue(stripExcluded(invoice)) as Values

    expect(getPath(blank, ['recipient', 'name'])).toBe('')
    expect(getPath(blank, ['project', 'deliverables'])).toEqual([
      { title: '', description: '', points: [''], quantity: '', rate: '' },
    ])
    expect(getPath(blank, ['financials', 'isDiscountPercentage'])).toBe(false)
  })
})

describe('toPayload', () => {
  const schema = stripExcluded(invoice)

  it('parses numbers, drops blanks and keeps booleans', () => {
    const form = setPath(
      setPath(
        setPath(emptyValue(schema), ['project', 'deliverables', 0, 'title'], ' Ad film '),
        ['project', 'deliverables', 0, 'rate'],
        '1,20,000',
      ),
      ['financials', 'isDiscountPercentage'],
      true,
    )

    const payload = toPayload(schema, form) as Values

    expect(getPath(payload, ['project', 'deliverables'])).toEqual([
      { title: 'Ad film', rate: 120000 },
    ])
    expect(getPath(payload, ['financials'])).toEqual({ isDiscountPercentage: true })
    expect(getPath(payload, ['recipient'])).toBeUndefined()
  })
})

describe('previewPayload', () => {
  it('fills every blank with a placeholder so the server always gets complete objects', () => {
    const schema = stripExcluded(internship)
    const form = setPath(emptyValue(schema), ['recipient', 'name'], 'Alex Mercer')

    const payload = previewPayload(schema, form)

    expect(getPath(payload, ['recipient', 'name'])).toBe('Alex Mercer')
    expect(getPath(payload, ['recipient', 'email'])).toBe('name@example.com')
    expect(getPath(payload, ['startDate'])).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(missingRequired(schema, payload)).toEqual([])
  })
})

describe('missingRequired', () => {
  const schema = stripExcluded(internship)

  it('lists blank required fields by path with a readable message', () => {
    const problems = missingRequired(
      schema,
      setPath(emptyValue(schema), ['recipient', 'name'], 'A'),
    )

    expect(problems.map((p) => p.path)).toContain('recipient.email')
    expect(problems.map((p) => p.path)).not.toContain('recipient.name')
    expect(problems.find((p) => p.path === 'recipient.email')?.message).toMatch(/is required$/)
  })

  it('requires a non-blank row for a required array (the server declares no row-level required)', () => {
    const inv = stripExcluded(invoice)
    const blank = emptyValue(inv)
    expect(missingRequired(inv, blank).map((p) => p.path)).toContain('project.deliverables')

    const half = setPath(blank, ['project', 'deliverables', 0, 'title'], 'Ad film')
    expect(missingRequired(inv, half).map((p) => p.path)).not.toContain('project.deliverables')
  })

  it('validates required fields inside array rows when the schema declares them', () => {
    const rows: JsonSchema = {
      type: 'object',
      required: ['lines'],
      properties: {
        lines: {
          type: 'array',
          items: {
            type: 'object',
            required: ['title', 'rate'],
            properties: { title: { type: 'string' }, rate: { type: 'number' } },
          },
        },
      },
    }
    const partial = {
      lines: [
        { title: 'Ad film', rate: '' },
        { title: '', rate: '' },
      ],
    }

    expect(missingRequired(rows, partial).map((p) => p.path)).toEqual(['lines.0.rate'])
  })
})

describe('helpers', () => {
  it('setPath is immutable and creates arrays for numeric segments', () => {
    const base = { a: { b: ['x'] } }
    const next = setPath(base, ['a', 'b', 1], 'y') as typeof base

    expect(next.a.b).toEqual(['x', 'y'])
    expect(base.a.b).toEqual(['x'])
  })

  it('withDefaults only fills blanks and applies array defaults to every row', () => {
    const merged = withDefaults(
      { a: '', b: 'keep', rows: [{ q: '' }, { q: '5' }] },
      { a: 'dflt', b: 'x', rows: [{ q: '1' }] },
    )

    expect(merged).toEqual({ a: 'dflt', b: 'keep', rows: [{ q: '1' }, { q: '5' }] })
  })

  it('overlay lets present keys win and recurses into objects', () => {
    expect(overlay({ a: { x: 1, y: 2 }, b: 3 }, { a: { y: 9 } })).toEqual({
      a: { x: 1, y: 9 },
      b: 3,
    })
  })

  it('samples enums, formats and numbers', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['project', 'day'] },
        email: { type: 'string', format: 'email' },
        qty: { type: 'number', minimum: 1 },
      },
    }

    expect(sampleValue(schema)).toEqual({ kind: 'project', email: 'name@example.com', qty: 1 })
  })
})