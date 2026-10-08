import { describe, expect, it } from 'vite-plus/test'

import type { JsonSchema, TemplateDetail } from '@/api'
import invoiceFixture from '@/test/fixtures/invoice.json'

import { normalizeHex, isEmail } from '../organization'
import { checkLeaf, isRealDate } from '../validate'

const invoice = (invoiceFixture as unknown as TemplateDetail).schema
const recipient = invoice.properties?.recipient?.properties ?? {}
const quantity = invoice.properties?.project?.properties?.deliverables?.items?.properties?.quantity

describe('checkLeaf with the real invoice schema', () => {
  const email = recipient.email as JsonSchema

  it('uses the server pattern for emails (the cases the live server rejects or accepts)', () => {
    expect(checkLeaf(email, 'acc')).toBe('Enter a valid email address')
    expect(checkLeaf(email, 'bad')).toBe('Enter a valid email address')
    expect(checkLeaf(email, 'a@b')).toBe('Enter a valid email address')
    expect(checkLeaf(email, 'a@b.in')).toBeNull()
    expect(checkLeaf(email, 'accounts@chaitheory.in')).toBeNull()
  })

  it('does not judge blanks: required-ness is a separate check', () => {
    expect(checkLeaf(email, '')).toBeNull()
    expect(checkLeaf(email, '   ')).toBeNull()
    expect(checkLeaf(email, undefined)).toBeNull()
  })

  it('enforces minimum on numbers and rejects non-numbers', () => {
    expect(checkLeaf(quantity as JsonSchema, '-1')).toBe('Must be at least 0')
    expect(checkLeaf(quantity as JsonSchema, '2')).toBeNull()
    expect(checkLeaf(quantity as JsonSchema, '1,20,000')).toBeNull()
    expect(checkLeaf(quantity as JsonSchema, 'abc')).toBe('Enter a number')
  })

  it('accepts any phone text, as the server does', () => {
    expect(checkLeaf(recipient.phone as JsonSchema, 'abc')).toBeNull()
  })
})

describe('checkLeaf generic constraints', () => {
  it('validates real calendar dates', () => {
    const date: JsonSchema = { type: 'string', format: 'date' }

    expect(checkLeaf(date, '2026-10-14')).toBeNull()
    expect(checkLeaf(date, '2026-02-30')).toBe('Use a real date as YYYY-MM-DD')
    expect(checkLeaf(date, '14/10/2026')).toBe('Use a real date as YYYY-MM-DD')
    expect(isRealDate('2028-02-29')).toBe(true)
    expect(isRealDate('2026-02-29')).toBe(false)
  })

  it('checks enums, integers, maximum and string length', () => {
    expect(checkLeaf({ type: 'string', enum: ['a', 'b'] }, 'c')).toBe('Choose one of: a, b')
    expect(checkLeaf({ type: 'integer' }, '1.5')).toBe('Enter a whole number')
    expect(checkLeaf({ type: 'number', maximum: 10 }, '11')).toBe('Must be at most 10')
    expect(checkLeaf({ type: 'string', minLength: 3 }, 'ab')).toBe('Use at least 3 characters')
    expect(checkLeaf({ type: 'string', maxLength: 2 }, 'abc')).toBe('Use at most 2 characters')
  })

  it('ignores a pattern the engine cannot compile instead of blocking the user', () => {
    expect(checkLeaf({ type: 'string', pattern: '(' }, 'anything')).toBeNull()
  })

  it('falls back to a loose email check when the schema has no pattern', () => {
    const email: JsonSchema = { type: 'string', format: 'email' }

    expect(checkLeaf(email, 'x@y.co')).toBeNull()
    expect(checkLeaf(email, 'x@y')).toBe('Enter a valid email address')
  })
})

describe('organisation helpers', () => {
  it('normalises hex colours', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC')
    expect(normalizeHex(' #5945ea ')).toBe('#5945EA')
    expect(normalizeHex('notacolor')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex('5945EA')).toBeNull()
  })

  it('checks emails', () => {
    expect(isEmail('billing@modesthumanbrands.com')).toBe(true)
    expect(isEmail('billing@')).toBe(false)
  })
})