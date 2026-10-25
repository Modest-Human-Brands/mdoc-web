import { describe, expect, it } from 'vite-plus/test'

import type { DocumentDetail, DocumentListItem } from '@/api'

import {
  activityOf,
  canChangeStatus,
  canSend,
  canVoid,
  isVoid,
  formatDay,
  matchesSearch,
  pageRange,
  signedCount,
  signerCaption,
  signersOf,
} from '../documents'

const detail = {
  id: 'd1',
  name: 'Monsoon Masala ad film',
  status: 'Sent',
  createdAt: '2026-10-07T10:00:00.000Z',
  updatedAt: '2026-10-08T10:00:00.000Z',
  routingQueue: [
    { order: 2, name: 'Arjun', email: 'a@x.in', role: 'Production house', status: 'PENDING' },
    { order: 1, name: 'Rhea', email: 'r@x.in', role: 'Client', status: 'SIGNED' },
    'junk',
  ],
} as unknown as DocumentDetail

describe('documents helpers', () => {
  it('formats days and page ranges', () => {
    expect(formatDay('2026-10-07T10:00:00.000Z')).toBe('7 Oct 2026')
    expect(formatDay(undefined)).toBe('')
    expect(pageRange(0, 10, 44)).toBe('1–10 of 44')
    expect(pageRange(40, 4, 44)).toBe('41–44 of 44')
    expect(pageRange(0, 0, 0)).toBe('0 of 0')
  })

  it('searches by name and template label on the loaded page', () => {
    const item = { name: 'Monsoon Masala ad film' } as DocumentListItem
    expect(matchesSearch(item, 'invoice', 'Invoice')).toBe(true)
    expect(matchesSearch(item, 'MONSOON', 'Invoice')).toBe(true)
    expect(matchesSearch(item, 'kolkata', 'Invoice')).toBe(false)
    expect(matchesSearch(item, '  ', 'Invoice')).toBe(true)
  })

  it('only drafts and ready documents can be sent', () => {
    expect(canSend('Draft')).toBe(true)
    expect(canSend('Ready')).toBe(true)
    expect(canSend('Sent')).toBe(false)
    expect(canSend('Void')).toBe(false)
  })

  it('reads the signing queue defensively and in order', () => {
    const signers = signersOf(detail)

    expect(signers.map((signer) => signer.name)).toEqual(['Rhea', 'Arjun'])
    expect(signedCount(signers)).toBe(1)
    expect(signersOf({ routingQueue: null })).toEqual([])
  })

  it('knows which statuses can be voided or have their status changed', () => {
    expect(canVoid('Sent')).toBe(true)
    expect(canVoid('Draft')).toBe(true)
    expect(canVoid('Completed')).toBe(false)
    expect(canVoid('Void')).toBe(false)
    expect(isVoid('Void')).toBe(true)
    expect(isVoid('Voided')).toBe(false)
    expect(canChangeStatus('Plan')).toBe(true)
    expect(canChangeStatus('Ready')).toBe(true)
    expect(canChangeStatus('Delivered')).toBe(false)
    expect(canChangeStatus('Sent')).toBe(false)
  })

  it('describes each signer by their turn', () => {
    const [rhea, arjun] = signersOf(detail)

    expect(signerCaption(rhea!, undefined, false)).toBe('Client')
    expect(signerCaption(arjun!, rhea, true)).toBe('Next')
    expect(signerCaption(arjun!, rhea, false)).toBe('Waiting for Rhea')
  })

  it('derives activity, newest first, from the document record', () => {
    const entries = activityOf(detail, signersOf(detail))

    expect(entries[0]!.at >= entries[entries.length - 1]!.at).toBe(true)
    expect(entries.map((entry) => entry.title)).toContain('Document created')
    expect(entries.map((entry) => entry.title)).toContain('Signing in progress')
  })

  it('reports completion once every signer has signed', () => {
    const done = signersOf(detail).map((signer) => ({ ...signer, status: 'SIGNED' as const }))
    const titles = activityOf(detail, done).map((entry) => entry.title)

    expect(titles).toContain('Everyone signed')
    expect(titles).not.toContain('Signing in progress')
  })
})