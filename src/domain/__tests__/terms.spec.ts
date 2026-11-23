import { describe, expect, it } from 'vite-plus/test'

import type { JsonSchema } from '@/api'

import { buildFormSchema, validateForm } from '../formSchema'
import { buildReview } from '../review'
import { emptyValue, schemaDefaults, toPayload, type Values } from '../schema'
import {
  addTerm,
  availableTerms,
  missingTerms,
  moveTerm,
  removeTerm,
  termDefaults,
  withRequired,
} from '../terms'

const terms: JsonSchema = {
  type: 'terms',
  multiple: true,
  options: [
    { slug: 'payment', title: 'Payment' },
    { slug: 'cancellation', title: 'Cancellation' },
    { slug: 'governing-law', title: 'Governing law' },
  ],
  default: ['payment', 'ghost'],
  required: ['governing-law'],
}

const root: JsonSchema = { type: 'object', properties: { terms } }

describe('term selection', () => {
  it('starts from the defaults, drops unknown slugs and appends required terms', () => {
    expect(termDefaults(terms)).toEqual(['payment', 'governing-law'])
  })

  it('keeps required terms when others are removed', () => {
    const chosen = ['payment', 'governing-law']

    expect(removeTerm(chosen, 'governing-law', terms)).toEqual(chosen)
    expect(removeTerm(chosen, 'payment', terms)).toEqual(['governing-law'])
    expect(withRequired(['payment'], terms)).toEqual(['payment', 'governing-law'])
  })

  it('adds without duplicates, reorders and lists what is left to add', () => {
    expect(addTerm(['payment'], 'payment')).toEqual(['payment'])
    expect(moveTerm(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveTerm(['a', 'b'], 1, 5)).toEqual(['a', 'b'])
    expect(availableTerms(terms, ['payment']).map((o) => o.slug)).toEqual([
      'cancellation',
      'governing-law',
    ])
    expect(missingTerms(terms, ['payment'])).toEqual(['governing-law'])
  })
})

describe('terms in the form', () => {
  it('uses an empty list as the blank value and the descriptor default as the default', () => {
    expect(emptyValue(root)).toEqual({ terms: [] })
    expect(schemaDefaults(root)).toEqual({ terms: ['payment', 'governing-law'] })
  })

  it('sends the ordered slugs, even when the list is empty', () => {
    expect(toPayload(root, { terms: ['b', 'a'] })).toEqual({ terms: ['b', 'a'] })
    expect(toPayload(root, { terms: [] })).toEqual({ terms: [] })
  })

  it('reports a missing required term', () => {
    const form = buildFormSchema(root)

    expect(validateForm(form, { terms: ['payment'] })).toEqual([
      expect.objectContaining({
        path: 'terms',
        kind: 'required',
        message: 'Governing law is required',
      }),
    ])
    expect(validateForm(form, { terms: ['payment', 'governing-law'] })).toEqual([])
  })

  it('shows term titles in the review, in order', () => {
    const sections = buildReview(root, { terms: ['governing-law', 'payment'] } as Values)

    expect(sections).toContainEqual({
      title: 'Terms',
      rows: [
        { label: 'Term 1', value: 'Governing law' },
        { label: 'Term 2', value: 'Payment' },
      ],
    })
  })
})