import { describe, expect, it } from 'vite-plus/test'

import {
  envelopeFrom,
  expiryIso,
  ordinalLabel,
  parseSigningLink,
  signersFormSchema,
  signingLink,
} from '../signers'

describe('signers', () => {
  it('labels the order, with the last signer countersigning', () => {
    expect(ordinalLabel(0, 3)).toBe('Signs 1st')
    expect(ordinalLabel(1, 3)).toBe('Signs 2nd')
    expect(ordinalLabel(2, 3)).toBe('Countersigns')
    expect(ordinalLabel(0, 1)).toBe('Signs 1st')
    expect(ordinalLabel(3, 6)).toBe('Signs 4th')
  })

  it('builds a sequential envelope in list order', () => {
    const envelope = envelopeFrom([
      { name: ' Rhea Kapoor ', email: 'rhea@chaitheory.in ', role: 'Client' },
      { name: 'Arjun', email: 'arjun@x.in', role: '' },
    ])

    expect(envelope).toEqual({
      routingType: 'SEQUENTIAL',
      signers: [
        { order: 1, name: 'Rhea Kapoor', email: 'rhea@chaitheory.in', role: 'Client' },
        { order: 2, name: 'Arjun', email: 'arjun@x.in', role: 'Signer' },
      ],
    })
  })

  it('computes the session expiry from days', () => {
    expect(expiryIso(7, new Date('2026-10-09T00:00:00.000Z'))).toBe('2026-10-16T00:00:00.000Z')
  })

  it('builds and parses signing links', () => {
    expect(signingLink('https://mdoc.app/', 'doc 1', 'a.b.c')).toBe(
      'https://mdoc.app/s/doc%201/a.b.c',
    )
    expect(parseSigningLink({ id: 'd', token: 't' })).toEqual({ id: 'd', token: 't' })
    expect(parseSigningLink({ id: 'd' })).toBeNull()
    expect(parseSigningLink({ id: ['d'], token: 't' })).toBeNull()
  })

  it('validates the signers form', () => {
    const good = {
      signers: [{ name: 'Rhea', email: 'rhea@x.in', role: 'Client' }],
      expiresInDays: '7',
    }
    expect(signersFormSchema.safeParse(good).success).toBe(true)
    expect(signersFormSchema.safeParse({ ...good, signers: [] }).success).toBe(false)
    expect(
      signersFormSchema.safeParse({ ...good, signers: [{ name: '', email: 'nope', role: '' }] })
        .success,
    ).toBe(false)
  })
})