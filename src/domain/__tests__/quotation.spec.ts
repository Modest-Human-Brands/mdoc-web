import { describe, expect, it } from 'vite-plus/test'

import type { DocumentListItem } from '@/api'

import { isQuotationField, pickableQuotations, quotationReference } from '../quotation'

describe('from quotation', () => {
  it('leaves voided quotations out', () => {
    const items = [{ status: 'Draft' }, { status: 'Void' }] as DocumentListItem[]
    expect(pickableQuotations(items)).toEqual([{ status: 'Draft' }])
  })

  it('takes the number and date from the saved quotation', () => {
    const rawData = { project: { quoteNumber: 'MHB-Q-26-009', quoteDate: '2026-09-25' } }
    expect(quotationReference({ rawData })).toEqual({ number: 'MHB-Q-26-009', date: '2026-09-25' })
    expect(quotationReference({ rawData: { project: {} } })).toBeNull()
    expect(quotationReference({ rawData: null })).toBeNull()
  })

  it('only replaces the quotation number on invoices', () => {
    expect(isQuotationField('invoice', ['project', 'quoteNumber'])).toBe(true)
    expect(isQuotationField('quotation', ['project', 'quoteNumber'])).toBe(false)
    expect(isQuotationField('invoice', ['project', 'invoiceNumber'])).toBe(false)
  })
})