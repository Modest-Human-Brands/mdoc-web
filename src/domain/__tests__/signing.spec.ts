import { describe, expect, it } from 'vite-plus/test'

import type { SignerField } from '@/api'

import {
  fieldValues,
  labelFromFieldId,
  missingText,
  fieldsOf,
  marksFor,
  planFields,
  resolvePages,
  signerSlots,
  stateFromSession,
  waitingLabel,
  waitingOn,
} from '../signing'

const fields = [
  { id: 'signer-signature', type: 'SIGNATURE', signerOrder: 1 },
  { id: 'signer-title', type: 'TEXT', signerOrder: 1 },
  { id: 'countersign', type: 'SIGNATURE', signerOrder: 2 },
] as unknown as SignerField[]

describe('signing', () => {
  it('resolves a field page selector to 1-based pages', () => {
    expect(resolvePages(-1, 4)).toEqual([4])
    expect(resolvePages(0, 4)).toEqual([1])
    expect(resolvePages('all-except-last', 4)).toEqual([1, 2, 3])
    expect(resolvePages('all-except-last', 1)).toEqual([])
    expect(resolvePages([0, -1], 3)).toEqual([1, 3])
    expect(resolvePages(undefined, 2)).toEqual([2])
    expect(resolvePages(9, 2)).toEqual([])
    expect(resolvePages(-1, 0)).toEqual([])
  })

  it('builds one mark per page for the signer, with readable labels', () => {
    const spots = [
      {
        id: 'contractor-signature',
        type: 'SIGNATURE',
        signerOrder: 1,
        pageIndex: 'all-except-last',
        x: 1,
        y: 2,
        width: 3,
        height: 4,
      },
      {
        id: 'contractor-signature',
        type: 'SIGNATURE',
        signerOrder: 1,
        pageIndex: -1,
        x: 1,
        y: 2,
        width: 3,
        height: 4,
      },
      {
        id: 'contractor-city',
        type: 'TEXT',
        signerOrder: 1,
        pageIndex: -1,
        x: 1,
        y: 2,
        width: 3,
        height: 4,
      },
      {
        id: 'company-signature',
        type: 'SIGNATURE',
        signerOrder: 2,
        pageIndex: -1,
        x: 1,
        y: 2,
        width: 3,
        height: 4,
      },
    ] as unknown as SignerField[]
    const marks = marksFor(fieldsOf(spots, 1), 3)

    expect(marks.map((mark) => [mark.page, mark.label])).toEqual([
      [1, 'Sign here'],
      [2, 'Sign here'],
      [3, 'Sign here'],
      [3, 'City'],
    ])
    expect(new Set(marks.map((mark) => mark.key)).size).toBe(marks.length)
  })

  it('derives one slot per signer order the template defines', () => {
    expect(signerSlots([])).toEqual([])
    expect(signerSlots(fields.slice(0, 2))).toEqual([{ order: 1, role: 'Signer' }])
    const contract = [
      { id: 'contractor-signature', type: 'SIGNATURE', signerOrder: 1 },
      { id: 'company-signature', type: 'SIGNATURE', signerOrder: 2 },
    ] as unknown as SignerField[]
    expect(signerSlots(contract)).toEqual([
      { order: 1, role: 'Contractor' },
      { order: 2, role: 'Company' },
    ])
  })

  it('labels text fields from their ids', () => {
    expect(labelFromFieldId('signer-title')).toBe('Title')
    expect(labelFromFieldId('signer-job_role')).toBe('Job role')
  })

  it('plans only the fields that belong to the current signer', () => {
    expect(planFields(fields, 1)).toEqual({
      signatureIds: ['signer-signature'],
      textFields: [{ id: 'signer-title', label: 'Title' }],
    })
    expect(planFields(fields, 2).signatureIds).toEqual(['countersign'])
  })

  it('falls back to the default signature field when the template has none', () => {
    expect(planFields([], 1)).toEqual({ signatureIds: ['signer-signature'], textFields: [] })
  })

  it('builds the prepare payload and reports missing text', () => {
    const plan = planFields(fields, 1)

    expect(
      fieldValues(plan, 'data:image/png;base64,AAA', { 'signer-title': ' Director ' }),
    ).toEqual({
      'signer-signature': 'data:image/png;base64,AAA',
      'signer-title': 'Director',
    })
    expect(missingText(plan, {})).toEqual(['Title'])
    expect(missingText(plan, { 'signer-title': 'x' })).toEqual([])
  })

  it('knows when a signer has already signed', () => {
    expect(stateFromSession('SIGNED')).toBe('already')
    expect(stateFromSession('PENDING')).toBe('landing')
  })

  it('counts the other signers still waiting', () => {
    const queue = [
      { order: 1, name: 'A', email: 'a@x.in', role: '', status: 'SIGNED' },
      { order: 2, name: 'B', email: 'b@x.in', role: '', status: 'PENDING' },
      { order: 3, name: 'C', email: 'c@x.in', role: '', status: 'PENDING' },
    ]
    expect(waitingOn(queue, 'b@x.in')).toBe(1)
    expect(waitingLabel(1)).toBe('1 more signer')
    expect(waitingLabel(2)).toBe('2 more signers')
    expect(waitingLabel(0)).toBe('No one else')
  })
})