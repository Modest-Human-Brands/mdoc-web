import type { SignerField, SignerQueueEntry } from '@/api'

export const SIGNATURE_FALLBACK_ID = 'signer-signature'

export interface TextFieldPlan {
  id: string
  label: string
}

export interface FieldPlan {
  signatureIds: string[]
  textFields: TextFieldPlan[]
}

export type SigningState = 'loading' | 'invalid' | 'landing' | 'signing' | 'signed' | 'already'

export function labelFromFieldId(id: string): string {
  const text = id
    .replace(/^signer-/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function planFields(fields: readonly SignerField[], order: number): FieldPlan {
  const mine = fields.filter((field) => Number(field.signerOrder) === Number(order))
  const signatureIds = mine
    .filter((field) => field.type === 'SIGNATURE' || field.type === 'INITIALS')
    .map((field) => field.id)
  const textFields = mine
    .filter((field) => field.type === 'TEXT' || field.type === 'NAME' || field.type === 'EMAIL')
    .map((field) => ({ id: field.id, label: labelFromFieldId(field.id) }))
  return {
    signatureIds: signatureIds.length > 0 ? signatureIds : [SIGNATURE_FALLBACK_ID],
    textFields,
  }
}

export interface FieldMark {
  key: string
  fieldId: string
  type: SignerField['type']
  label: string
  page: number
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_PAGE_SIZE = { width: 595.28, height: 841.89 }

export function fieldsOf(fields: readonly SignerField[], order: number): SignerField[] {
  return fields.filter((field) => Number(field.signerOrder) === Number(order))
}

export function resolvePages(pageIndex: SignerField['pageIndex'], pageCount: number): number[] {
  if (pageCount < 1) return []
  const fromIndex = (index: number) => (index < 0 ? pageCount + index : index) + 1
  let pages: number[]
  if (pageIndex === 'all-except-last')
    pages = Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => i + 1)
  else if (pageIndex === 'all') pages = Array.from({ length: pageCount }, (_, i) => i + 1)
  else if (Array.isArray(pageIndex)) pages = pageIndex.map(fromIndex)
  else if (typeof pageIndex === 'number') pages = [fromIndex(pageIndex)]
  else pages = [pageCount]
  return pages.filter((page) => page >= 1 && page <= pageCount)
}

export function markLabel(field: Pick<SignerField, 'id' | 'type'>): string {
  if (field.type === 'SIGNATURE') return 'Sign here'
  if (field.type === 'INITIALS') return 'Initial here'
  if (field.type === 'DATE') return 'Date'
  return labelFromFieldId(field.id.replace(/^(client|company|contractor)-/, ''))
}

export function marksFor(fields: readonly SignerField[], pageCount: number): FieldMark[] {
  return fields.flatMap((field) =>
    resolvePages(field.pageIndex, pageCount).map((page) => ({
      key: `${field.id}:${page}`,
      fieldId: field.id,
      type: field.type,
      label: markLabel(field),
      page,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
    })),
  )
}

export interface SignerSlot {
  order: number
  role: string
}

function roleFromFieldId(id: string): string {
  const prefix = id.split('-')[0] ?? ''
  if (prefix === '' || prefix === 'signer') return 'Signer'
  return prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

export function signerSlots(fields: readonly SignerField[]): SignerSlot[] {
  const orders = fields.map((field) => Number(field.signerOrder)).filter((n) => n >= 1)
  const count = orders.length > 0 ? Math.max(...orders) : 0
  return Array.from({ length: count }, (_, index) => {
    const first = fields.find((field) => Number(field.signerOrder) === index + 1)
    return { order: index + 1, role: first ? roleFromFieldId(first.id) : 'Signer' }
  })
}

export function fieldValues(
  plan: FieldPlan,
  signature: string,
  texts: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const id of plan.signatureIds) values[id] = signature
  for (const field of plan.textFields) {
    const text = (texts[field.id] ?? '').trim()
    if (text !== '') values[field.id] = text
  }
  return values
}

export function missingText(plan: FieldPlan, texts: Record<string, string>): string[] {
  return plan.textFields
    .filter((field) => (texts[field.id] ?? '').trim() === '')
    .map((field) => field.label)
}

export function stateFromSession(status: string): SigningState {
  return status === 'SIGNED' ? 'already' : 'landing'
}

export function waitingOn(signers: readonly SignerQueueEntry[], currentEmail: string): number {
  return signers.filter((signer) => signer.status === 'PENDING' && signer.email !== currentEmail)
    .length
}

export function waitingLabel(count: number): string {
  if (count === 0) return 'No one else'
  return `${count} more ${count === 1 ? 'signer' : 'signers'}`
}