import { describe, expect, it } from 'vite-plus/test'

import { clientFormSchema } from '../clientForm'
import {
  clientInitials,
  clientSubtitle,
  coveredKeys,
  emptyClient,
  recipientPatch,
} from '../clients'

const chai = {
  name: 'Chai Theory Pvt Ltd',
  email: 'accounts@chaitheory.in',
  phone: '+91 98200 12345',
  address: 'Bandra West, Mumbai',
}

describe('clients', () => {
  it('makes initials from the first two words', () => {
    expect(clientInitials('Chai Theory Pvt Ltd')).toBe('CT')
    expect(clientInitials('  lotus ')).toBe('L')
    expect(clientInitials('')).toBe('')
  })

  it('describes a client by email and city', () => {
    expect(clientSubtitle(chai)).toBe('accounts@chaitheory.in · Mumbai')
    expect(clientSubtitle({ ...emptyClient(), name: 'X' })).toBe('')
  })

  it('patches only the recipient keys the template has', () => {
    expect(recipientPatch(chai, ['name', 'email', 'role'])).toEqual({
      name: chai.name,
      email: chai.email,
    })
  })

  it('hides only the fields the client can fill', () => {
    expect(coveredKeys(chai, ['name', 'email', 'phone', 'address', 'role'])).toEqual([
      'name',
      'email',
      'phone',
      'address',
    ])
    expect(coveredKeys({ ...chai, phone: '' }, ['name', 'phone'])).toEqual(['name'])
    expect(coveredKeys(null, ['name'])).toEqual([])
  })

  it('validates the client form', () => {
    expect(clientFormSchema.safeParse(chai).success).toBe(true)
    expect(clientFormSchema.safeParse({ ...chai, name: ' ' }).success).toBe(false)
    expect(clientFormSchema.safeParse({ ...chai, email: 'nope' }).success).toBe(false)
    expect(clientFormSchema.safeParse({ ...chai, email: '' }).success).toBe(true)
  })
})