import { getPath, setPath, type Values } from './schema'

export interface InvoiceTotals {
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  amountDue: number
}

/** Parses user-typed amounts such as "1,20,000" or "₹ 48000.50"; blanks and junk become 0. */
export function parseAmount(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  if (typeof input !== 'string') return 0
  const value = Number.parseFloat(input.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(value) ? value : 0
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Works on the form's raw values (strings) using the API's field names:
 * `project.deliverables[{quantity, rate}]` and `financials{discountValue, isDiscountPercentage,
 * taxRate, amountPaid}`. Discount applies to the subtotal, tax to the discounted subtotal;
 * amount due = total − amount paid (never negative).
 */
export function computeTotals(values: Values): InvoiceTotals {
  const lines = getPath(values, ['project', 'deliverables'])
  const subtotal = round2(
    (Array.isArray(lines) ? lines : []).reduce(
      (sum: number, line: unknown) =>
        sum +
        parseAmount((line as Values | undefined)?.quantity) *
          parseAmount((line as Values | undefined)?.rate),
      0,
    ),
  )
  const raw = parseAmount(getPath(values, ['financials', 'discountValue']))
  const isPercent = getPath(values, ['financials', 'isDiscountPercentage']) === true
  const discount = round2(Math.min(subtotal, isPercent ? (subtotal * raw) / 100 : raw))
  const tax = round2(
    ((subtotal - discount) * parseAmount(getPath(values, ['financials', 'taxRate']))) / 100,
  )
  const total = round2(subtotal - discount + tax)
  const paid = round2(parseAmount(getPath(values, ['financials', 'amountPaid'])))
  return { subtotal, discount, tax, total, paid, amountDue: Math.max(0, round2(total - paid)) }
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

/** "₹48,000" with Indian digit grouping. */
export function formatInr(amount: number): string {
  return `₹${inr.format(amount)}`
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Adds whole days to an ISO date (yyyy-mm-dd); returns '' for invalid input. */
export function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return ''
  return new Date(base.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** "7 Oct 2026" for the email body. */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "Modest Human Brands", 2026-10-07, 14 gives "MHB-I-26-014". */
export function makeInvoiceNumber(name: string, isoDate: string, seq: number): string {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || 'INV'
  return `${initials}-I-${isoDate.slice(2, 4)}-${String(seq).padStart(3, '0')}`
}

/**
 * Product defaults applied when a template is first opened. They only fill blanks, so nothing the
 * user typed is overwritten.
 */
export function templateDefaults(templateId: string, orgName: string, seq: number): Values {
  const date = today()
  if (templateId === 'invoice') {
    let defaults: unknown = {}
    defaults = setPath(defaults, ['pricingModel'], 'project')
    defaults = setPath(defaults, ['dueDate'], addDays(date, 7))
    defaults = setPath(defaults, ['project', 'invoiceDate'], date)
    defaults = setPath(
      defaults,
      ['project', 'invoiceNumber'],
      makeInvoiceNumber(orgName, date, seq),
    )
    defaults = setPath(defaults, ['project', 'deliverables'], [{ quantity: '1' }])
    defaults = setPath(defaults, ['financials', 'discountLabel'], 'Discount')
    defaults = setPath(defaults, ['financials', 'isDiscountPercentage'], true)
    defaults = setPath(defaults, ['financials', 'taxLabel'], 'GST')
    defaults = setPath(defaults, ['financials', 'taxRate'], '0')
    defaults = setPath(defaults, ['financials', 'discountValue'], '0')
    defaults = setPath(defaults, ['financials', 'amountPaid'], '0')
    return defaults as Values
  }
  return {}
}

/** Templates whose schema carries deliverables + financials get the amount-due callout. */
export function hasBilling(values: Values): boolean {
  return getPath(values, ['financials']) !== undefined && getPath(values, ['project']) !== undefined
}