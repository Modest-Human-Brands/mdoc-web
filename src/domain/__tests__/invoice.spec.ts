import { describe, expect, it } from 'vite-plus/test'

import {
  addDays,
  computeTotals,
  formatInr,
  hasBilling,
  makeInvoiceNumber,
  parseAmount,
  templateDefaults,
} from '../invoice'
import type { Values } from '../schema'

describe('parseAmount', () => {
  it('handles Indian grouping, symbols, numbers and junk', () => {
    expect(parseAmount('1,20,000')).toBe(120000)
    expect(parseAmount('₹ 48000.50')).toBe(48000.5)
    expect(parseAmount(75)).toBe(75)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount(undefined)).toBe(0)
  })
})

function form(): Values {
  return {
    project: { deliverables: [{ quantity: '1', rate: '1,20,000' }] },
    financials: {
      discountValue: '10',
      isDiscountPercentage: true,
      taxRate: '0',
      amountPaid: '60,000',
    },
  }
}

describe('computeTotals', () => {
  it('matches the amount due shown in the design (₹48,000)', () => {
    const totals = computeTotals(form())

    expect(totals).toEqual({
      subtotal: 120000,
      discount: 12000,
      tax: 0,
      total: 108000,
      paid: 60000,
      amountDue: 48000,
    })
    expect(formatInr(totals.amountDue)).toBe('₹48,000')
  })

  it('applies a flat discount and tax on the discounted subtotal', () => {
    const values = form()
    values.financials = {
      discountValue: '20,000',
      isDiscountPercentage: false,
      taxRate: '18',
      amountPaid: '',
    }

    const totals = computeTotals(values)

    expect(totals.tax).toBe(18000)
    expect(totals.total).toBe(118000)
  })

  it('caps the discount at the subtotal and never goes negative', () => {
    const values = form()
    values.financials = {
      discountValue: '500',
      isDiscountPercentage: true,
      amountPaid: '1,00,000',
    }

    const totals = computeTotals(values)

    expect(totals.discount).toBe(120000)
    expect(totals.amountDue).toBe(0)
  })

  it('sums several rows and tolerates missing sections', () => {
    const values = form()
    ;(values.project as { deliverables: Values[] }).deliverables.push(
      { quantity: '3', rate: '1,000' },
      {},
    )
    ;(values.financials as Values).discountValue = ''

    expect(computeTotals(values).subtotal).toBe(123000)
    expect(computeTotals({}).amountDue).toBe(0)
  })
})

describe('invoice helpers', () => {
  it('adds days across month boundaries and rejects bad input', () => {
    expect(addDays('2026-10-28', 7)).toBe('2026-11-04')
    expect(addDays('nope', 7)).toBe('')
  })

  it('builds prefix, year and padded sequence', () => {
    expect(makeInvoiceNumber('Modest Human Brands', '2026-10-07', 14)).toBe('MHB-I-26-014')
    expect(makeInvoiceNumber('', '2026-10-07', 1)).toBe('INV-I-26-001')
  })

  it('only gives the invoice defaults, in the API field names', () => {
    const defaults = templateDefaults('invoice', 'Modest Human Brands', 3)

    expect(defaults).toMatchObject({
      pricingModel: 'project',
      project: { invoiceNumber: expect.stringMatching(/^MHB-I-\d{2}-003$/) as string },
      financials: { isDiscountPercentage: true, taxLabel: 'GST' },
    })
    expect(templateDefaults('quotation', 'x', 1)).toEqual({})
  })

  it('shows billing only when project and financials exist', () => {
    expect(hasBilling(form())).toBe(true)
    expect(hasBilling({ recipient: {} })).toBe(false)
  })
})