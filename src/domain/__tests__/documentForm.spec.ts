import { describe, expect, it } from 'vite-plus/test'

import type { JsonSchema } from '@/api'

import { keepUnlistedFields, toFormValues } from '../documentForm'

const schema: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    date: { type: 'string', format: 'date' },
    rate: { type: 'number' },
    paid: { type: 'boolean' },
    client: { type: 'object', properties: { name: { type: 'string' } } },
    items: {
      type: 'array',
      items: { type: 'object', properties: { quantity: { type: 'number' } } },
    },
  },
}

describe('toFormValues', () => {
  it('turns saved data into what the inputs hold', () => {
    expect(
      toFormValues(schema, {
        title: 'Shoot',
        date: '2026-10-02T00:00:00.000Z',
        rate: 1500,
        paid: true,
        client: { name: 'Chai' },
        items: [{ quantity: 2 }],
      }),
    ).toEqual({
      title: 'Shoot',
      date: '2026-10-02',
      rate: '1500',
      paid: true,
      client: { name: 'Chai' },
      items: [{ quantity: '2' }],
    })
  })

  it('leaves missing fields blank', () => {
    expect(toFormValues(schema, {})).toMatchObject({ title: '', paid: false, client: { name: '' } })
  })
})

describe('saved terms', () => {
  const terms: JsonSchema = {
    type: 'terms',
    options: [
      { slug: 'payment', title: 'Payment' },
      { slug: 'law', title: 'Governing law' },
    ],
    required: ['law'],
  }

  it('become slugs, keeping required ones and naming those no longer offered', () => {
    const dropped: string[] = []
    const saved = {
      items: [
        { slug: 'old', title: 'Old clause' },
        { slug: 'payment', title: 'Payment' },
      ],
    }

    expect(toFormValues(terms, saved, dropped)).toEqual(['payment', 'law'])
    expect(dropped).toEqual(['Old clause'])
  })
})

describe('keepUnlistedFields', () => {
  it('keeps saved fields that have no input, but not the stored branding', () => {
    const saved = {
      title: 'Old',
      memo: 'kept',
      client: { name: 'Old', gstin: '27X' },
      organization: { name: 'Old branding' },
    }

    expect(keepUnlistedFields(schema, saved, { title: 'New', client: { name: 'New' } })).toEqual({
      title: 'New',
      memo: 'kept',
      client: { name: 'New', gstin: '27X' },
    })
  })

  it('does not bring back a listed field that was cleared', () => {
    expect(keepUnlistedFields(schema, { title: 'Old' }, {})).toEqual({})
  })
})