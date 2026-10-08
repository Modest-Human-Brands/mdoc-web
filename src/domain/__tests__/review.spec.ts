import { describe, expect, it } from 'vite-plus/test'

import type { JsonSchema, TemplateDetail } from '@/api'
import invoiceFixture from '@/test/fixtures/invoice.json'
import retainerFixture from '@/test/fixtures/retainer-contract.json'

import { emptyOrganization } from '../organization'
import { buildReview, formatReviewValue, organizationReview } from '../review'

const invoice = (invoiceFixture as unknown as TemplateDetail).schema
const retainer = (retainerFixture as unknown as TemplateDetail).schema

const invoiceValues = {
  recipient: {
    name: 'Chai Theory Pvt Ltd',
    address: 'Mumbai',
    email: 'accounts@chaitheory.in',
    phone: '',
  },
  pricingModel: 'project',
  project: {
    title: 'Monsoon Masala ad film',
    invoiceNumber: 'MHB-I-26-001',
    invoiceDate: '2026-10-07',
    deliverables: [
      {
        title: 'Ad film production',
        description: '30s master edit',
        points: ['Delivered in 4K', ''],
        quantity: '1',
        rate: '120000',
      },
      { title: '', description: '', points: [''], quantity: '1', rate: '' },
    ],
  },
  financials: { discountLabel: 'Discount', discountValue: '10', isDiscountPercentage: true },
  dueDate: '2026-10-14',
}

function rowsOf(sections: ReturnType<typeof buildReview>, title: string) {
  return sections.find((s) => s.title === title)?.rows ?? []
}

describe('formatReviewValue', () => {
  it('formats each kind of field the way it is shown on the PDF', () => {
    expect(formatReviewValue({ type: 'string', format: 'date' }, '2026-10-14')).toBe('14 Oct 2026')
    expect(formatReviewValue({ type: 'number' }, '1,20,000')).toBe('1,20,000')
    expect(formatReviewValue({ type: 'number' }, 120000)).toBe('1,20,000')
    expect(formatReviewValue({ type: 'string', enum: ['project', 'day'] }, 'day')).toBe('Day')
    expect(formatReviewValue({ type: 'boolean', title: 'Is Discount Percentage' }, true)).toBe(
      'Percentage',
    )
    expect(formatReviewValue({ type: 'boolean', title: 'Is Discount Percentage' }, false)).toBe(
      'Flat amount',
    )
    expect(formatReviewValue({ type: 'boolean', title: 'Signed' }, true)).toBe('Yes')
  })

  it('returns nothing for blank values', () => {
    expect(formatReviewValue({ type: 'string' }, '   ')).toBe('')
    expect(formatReviewValue({ type: 'string' }, undefined)).toBe('')
    expect(formatReviewValue({ type: 'boolean', title: 'Signed' }, undefined)).toBe('')
  })
})

describe('buildReview (invoice)', () => {
  const sections = buildReview(invoice, invoiceValues)

  it('groups the filled values by the schema sections, in order, skipping blanks', () => {
    expect(sections.map((s) => s.title)).toEqual([
      'Recipient',
      'Project',
      'Deliverable 1',
      'Deliverable 1 · Points',
      'Financials',
      'Details',
    ])
    expect(rowsOf(sections, 'Recipient')).toEqual([
      { label: 'Name', value: 'Chai Theory Pvt Ltd' },
      { label: 'Address', value: 'Mumbai' },
      { label: 'Email', value: 'accounts@chaitheory.in' },
    ])
  })

  it('formats dates and amounts and numbers each deliverable row', () => {
    expect(rowsOf(sections, 'Project')).toContainEqual({
      label: 'Invoice Date',
      value: '7 Oct 2026',
    })
    expect(rowsOf(sections, 'Deliverable 1')).toEqual([
      { label: 'Title', value: 'Ad film production' },
      { label: 'Description', value: '30s master edit' },
      { label: 'Quantity', value: '1' },
      { label: 'Rate', value: '1,20,000' },
    ])
    expect(rowsOf(sections, 'Deliverable 1 · Points')).toEqual([
      { label: 'Point 1', value: 'Delivered in 4K' },
    ])
  })

  it('leaves out rows that hold nothing, and shows root fields under Details', () => {
    expect(sections.map((s) => s.title)).not.toContain('Deliverable 2')
    expect(rowsOf(sections, 'Details')).toEqual([
      { label: 'Pricing Model', value: 'Project' },
      { label: 'Due Date', value: '14 Oct 2026' },
    ])
    expect(rowsOf(sections, 'Financials')).toContainEqual({
      label: 'Is Discount Percentage',
      value: 'Percentage',
    })
  })

  it('is empty for a blank form', () => {
    expect(buildReview(invoice, {})).toEqual([])
  })
})

describe('buildReview (other shapes)', () => {
  it('keeps long terms text intact as one row', () => {
    const terms = 'First clause.\n\nSecond clause with more detail.'
    const sections = buildReview(retainer, { terms: { content: terms, lastUpdated: '2026-10-01' } })

    expect(rowsOf(sections, 'Terms')).toEqual(
      expect.arrayContaining([{ label: 'Content', value: terms }]),
    )
  })

  it('never lists the organization the server resolves', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        organization: { type: 'object', properties: { name: { type: 'string' } } },
        note: { type: 'string', title: 'Note' },
      },
    }

    expect(buildReview(schema, { organization: { name: 'X' }, note: 'hi' })).toEqual([
      { title: 'Details', rows: [{ label: 'Note', value: 'hi' }] },
    ])
  })
})

describe('organizationReview', () => {
  it('falls back to the preset id while the profile is untouched', () => {
    expect(organizationReview(emptyOrganization())).toEqual({
      title: 'Brand',
      rows: [{ label: 'Organisation', value: 'modest-human-brands' }],
    })
  })

  it('lists what was filled in', () => {
    const profile = {
      ...emptyOrganization(),
      name: 'ZZZ Studio',
      gstin: '29ABCDE1234F1Z5',
      contactEmail: 'a@zzz.in',
      phone: '+91 1',
    }

    expect(organizationReview(profile).rows).toEqual([
      { label: 'Business name', value: 'ZZZ Studio' },
      { label: 'GSTIN', value: '29ABCDE1234F1Z5' },
      { label: 'Contact', value: 'a@zzz.in · +91 1' },
    ])
  })
})