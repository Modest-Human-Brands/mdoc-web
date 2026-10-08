import { describe, expect, it } from 'vite-plus/test'

import { DEFAULT_FONT, emptyOrganization, fontName, toOrganizationOverride } from '../organization'

function profile(changes: Partial<ReturnType<typeof emptyOrganization>> = {}) {
  return { ...emptyOrganization(), ...changes }
}

describe('toOrganizationOverride', () => {
  it('returns null for an untouched profile, so the preset id is used', () => {
    expect(toOrganizationOverride(profile())).toBeNull()
  })

  it('sends only what was set, carrying the preset id', () => {
    const override = toOrganizationOverride(
      profile({ name: ' ZZZ Test Studio ', gstin: '29ABCDE1234F1Z5', billingEmail: 'b@zzz.in' }),
    )

    expect(override).toEqual({
      id: 'modest-human-brands',
      name: 'ZZZ Test Studio',
      gstin: '29ABCDE1234F1Z5',
      billingEmail: 'b@zzz.in',
    })
  })

  it('leaves default colours and entity out so the preset keeps its own', () => {
    const override = toOrganizationOverride(
      profile({ name: 'X', primary: '#111827', accent: '#5945ea' }),
    )

    expect(override).not.toHaveProperty('branding')
    expect(override).not.toHaveProperty('entityType')
  })

  it('sends changed colours normalised, and a changed entity type', () => {
    const override = toOrganizationOverride(
      profile({ primary: '#abc', accent: '#0E7490', entityType: 'Private Limited' }),
    )

    expect(override).toMatchObject({
      entityType: 'Private Limited',
      branding: { color: { primary: '#AABBCC', accent: '#0E7490' } },
    })
  })

  it('never sends an invalid colour', () => {
    const override = toOrganizationOverride(profile({ name: 'X', primary: 'notacolor' }))

    expect(override).not.toHaveProperty('branding')
  })

  it('maps bank details, with the account number as a number', () => {
    const override = toOrganizationOverride(
      profile({
        bank: {
          accountName: 'ZZZ',
          accountNumber: '1234 5678 9012',
          bankName: 'ICICI',
          ifscCode: '',
        },
      }),
    )

    expect(override).toMatchObject({
      accountDetails: { accountName: 'ZZZ', bankName: 'ICICI', accountNumber: 123456789012 },
    })
    expect(override?.accountDetails).not.toHaveProperty('ifscCode')
  })

  it('sends the logo data URL under branding', () => {
    const override = toOrganizationOverride(
      profile({ logo: { name: 'logo.png', dataUrl: 'data:image/png;base64,AAAA' } }),
    )

    expect(override).toMatchObject({ branding: { logo: 'data:image/png;base64,AAAA' } })
  })

  it('sends the font name the server stores: the family without spaces', () => {
    expect(toOrganizationOverride(profile({ font: 'Open Sans' }))).toEqual({
      id: 'modest-human-brands',
      branding: { font: 'OpenSans' },
    })
    expect(fontName('Playfair Display')).toBe('PlayfairDisplay')
  })

  it('sends nothing for the default font', () => {
    expect(toOrganizationOverride(profile({ font: DEFAULT_FONT }))).toBeNull()
  })
})

describe('toOrganizationOverride (profile details)', () => {
  it('sends address, contact channels, founding year and the relationship once set', () => {
    const override = toOrganizationOverride(
      profile({
        address: ' 99 Test Road, Pune ',
        website: 'https://zzz.example',
        whatsapp: '+911234567890',
        foundedYear: '2019',
        tradeRelationship: 'Trading As',
      }),
    )

    expect(override).toEqual({
      id: 'modest-human-brands',
      address: '99 Test Road, Pune',
      website: 'https://zzz.example',
      whatsapp: '+911234567890',
      foundedYear: 2019,
      tradeRelationship: 'Trading As',
    })
  })

  it('sends only the socials that have a link', () => {
    const base = emptyOrganization()
    const override = toOrganizationOverride({
      ...base,
      socials: { ...base.socials, instagram: 'https://instagram.com/zzz' },
    })

    expect(override).toEqual({
      id: 'modest-human-brands',
      socials: { instagram: 'https://instagram.com/zzz' },
    })
  })

  it('leaves the default relationship and a blank year out', () => {
    expect(toOrganizationOverride(profile({ name: 'X' }))).toEqual({
      id: 'modest-human-brands',
      name: 'X',
    })
  })
})