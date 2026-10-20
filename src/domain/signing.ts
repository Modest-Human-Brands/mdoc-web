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