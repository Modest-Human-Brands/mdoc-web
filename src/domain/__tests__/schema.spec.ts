import { describe, expect, it } from 'vite-plus/test'

import type { TemplateDetail } from '@/api'
import invoiceFixture from '@/test/fixtures/invoice.json'
import internshipFixture from '@/test/fixtures/internship-completion-certificate.json'

import {
  emptyValue,
  getPath,
  orderedProperties,
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
    ])
  })

  it('no longer lists organization in the schema (the Brand step owns it)', () => {
    expect(Object.keys(invoice.properties ?? {})).not.toContain('organization')
    expect(invoice.required).not.toContain('organization')
    const withOrg = {
      ...invoice,
      properties: { ...invoice.properties, organization: { type: 'object' as const } },
    }
    expect(Object.keys(stripExcluded(withOrg).properties ?? {})).not.toContain('organization')
  })

  it('carries x-auto and default hints', () => {
    const project = invoice.properties?.project?.properties
    const financials = invoice.properties?.financials?.properties

    expect(project?.invoiceNumber?.['x-auto']).toBe(true)
    expect(financials?.taxRate?.default).toBe(18)
    expect(invoice.properties?.pricingModel?.default).toBe('project')
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
})

describe('payload from typed values', () => {
  const schema = stripExcluded(internship)

  it('sends what the user typed, even if invalid: the server draft mode reports it as a warning', () => {
    const form = setPath(emptyValue(schema), ['recipient', 'email'], 'acc')

    expect((toPayload(schema, form) as Values).recipient).toMatchObject({ email: 'acc' })
  })
})