import { getPath, setPath, type Values } from './schema'

export interface InvoiceTotals {
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  amountDue: number
}

export function parseAmount(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  if (typeof input !== 'string') return 0
  const value = Number.parseFloat(input.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(value) ? value : 0
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

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

export function formatInr(amount: number): string {
  return `₹${inr.format(amount)}`
}

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return ''
  return new Date(base.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

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

export const IGNORED_SERVER_DEFAULTS: Record<string, string> = {
  'financials.amountPaid': '0',
}

export function templateDefaults(templateId: string): Values {
  const date = today()
  if (templateId === 'invoice') {
    let defaults: unknown = {}
    defaults = setPath(defaults, ['dueDate'], addDays(date, 7))
    defaults = setPath(defaults, ['project', 'invoiceDate'], date)
    defaults = setPath(defaults, ['project', 'deliverables'], [{ quantity: '1' }])
    return defaults as Values
  }
  return {}
}

export function hasBilling(values: Values): boolean {
  return getPath(values, ['financials']) !== undefined && getPath(values, ['project']) !== undefined
}