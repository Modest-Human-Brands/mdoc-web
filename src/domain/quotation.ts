import type { DocumentDetail, DocumentListItem } from '@/api'

import { textAt } from './schema'

export const QUOTATION_TEMPLATE_ID = 'quotation'

export interface QuotationReference {
  number: string
  date: string
}

/** A voided quotation was withdrawn, so nothing new should be billed against it. */
export function pickableQuotations(items: readonly DocumentListItem[]): DocumentListItem[] {
  return items.filter((item) => item.status !== 'Void')
}

/** What an invoice takes from a quotation: its number and date. Null when it was saved without one. */
export function quotationReference(
  detail: Pick<DocumentDetail, 'rawData'>,
): QuotationReference | null {
  const number = textAt(detail.rawData, ['project', 'quoteNumber'])
  if (number === '') return null
  return { number, date: textAt(detail.rawData, ['project', 'quoteDate']) }
}

export function isQuotationField(templateId: string | null, path: readonly (string | number)[]) {
  return templateId === 'invoice' && path.join('.') === 'project.quoteNumber'
}