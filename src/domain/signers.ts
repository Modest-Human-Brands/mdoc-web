import { z } from 'zod'

import type { EnvelopeRequest } from '@/api'

import { isEmail } from './organization'

export const EXPIRY_OPTIONS = [
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
] as const

export interface SignerRow {
  name: string
  email: string
  role: string
}

export interface SignersForm {
  signers: SignerRow[]
  expiresInDays: string
}

export const signersFormSchema = z.object({
  signers: z
    .array(
      z.object({
        name: z.string().refine((value) => value.trim() !== '', 'Name is required'),
        email: z.string().refine((value) => isEmail(value), 'Enter a valid email address'),
        role: z.string(),
      }),
    )
    .min(1, 'Add at least one signer'),
  expiresInDays: z.string(),
})

export function emptySigner(): SignerRow {
  return { name: '', email: '', role: 'Signer' }
}

export function ordinalLabel(index: number, total: number): string {
  if (total > 1 && index === total - 1) return 'Countersigns'
  const names = ['1st', '2nd', '3rd']
  return `Signs ${names[index] ?? `${index + 1}th`}`
}

export function envelopeFrom(rows: SignerRow[]): EnvelopeRequest {
  return {
    routingType: 'SEQUENTIAL',
    signers: rows.map((row, index) => ({
      order: index + 1,
      name: row.name.trim(),
      email: row.email.trim(),
      role: row.role.trim() || 'Signer',
    })),
  }
}

export function expiryIso(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function signingLink(origin: string, documentId: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/s/${encodeURIComponent(documentId)}/${encodeURIComponent(token)}`
}

export function parseSigningLink(params: {
  id?: unknown
  token?: unknown
}): { id: string; token: string } | null {
  const id = typeof params.id === 'string' ? params.id : ''
  const token = typeof params.token === 'string' ? params.token : ''
  return id && token ? { id, token } : null
}