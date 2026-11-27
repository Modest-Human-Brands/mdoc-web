import { describe, expect, it } from 'vite-plus/test'

import {
  emptyOrganization,
  fontFamily,
  fontName,
  fromStoredOrganization,
  STORED_LOGO_NAME,
  toOrganizationPatch,
  toPreviewOrganization,
  type StoredOrganization,
} from '../organization'

const stored: StoredOrganization = {
  id: 'zzz',
  name: 'ZZZ Studio',
  contactEmail: 'a@zzz.in',
  foundedYear: 2019,
  accountDetails: { accountName: 'ZZZ', accountNumber: 123456789012 },
  branding: {
    logo: 'https://zzz.example/logo.png',
    color: { primary: '#262626', accent: '#cd2d2d' },
    font: 'PlayfairDisplay',
    qr: { eyeShape: 'leaf', target: 'upi' },
  },
  socials: { instagram: 'https://instagram.com/zzz', mastodon: 'https://m.example/zzz' },
}

const edit = (changes: Partial<ReturnType<typeof emptyOrganization>>) =>
  toOrganizationPatch(fromStoredOrganization(stored), {
    ...fromStoredOrganization(stored),
    ...changes,
  })

describe('fromStoredOrganization', () => {
  it('fills the form from the Notion record', () => {
    expect(fromStoredOrganization(stored)).toMatchObject({
      id: 'zzz',
      name: 'ZZZ Studio',
      legalName: '',
      foundedYear: '2019',
      bank: { accountName: 'ZZZ', accountNumber: '123456789012', ifscCode: '' },
      logo: { name: STORED_LOGO_NAME, dataUrl: 'https://zzz.example/logo.png' },
      font: 'Playfair Display',
      qr: { eyeShape: 'leaf' },
      socials: { instagram: 'https://instagram.com/zzz', youtube: '' },
    })
  })

  it('turns stored font names back into families', () => {
    expect(['Exo2', 'DMSans', 'Oxanium', 'OpenSans'].map(fontFamily)).toEqual([
      'Exo 2',
      'DM Sans',
      'Oxanium',
      'Open Sans',
    ])
    expect(fontName('Playfair Display')).toBe('PlayfairDisplay')
  })
})

describe('toOrganizationPatch', () => {
  it('is empty for an untouched record, so nothing is rewritten', () => {
    expect(edit({})).toEqual({})
  })

  it('ignores differences that would store the same value', () => {
    expect(edit({ name: ' ZZZ Studio ', accent: '#CD2D2D', font: 'PlayfairDisplay' })).toEqual({})
  })

  it('sends only the changed fields', () => {
    expect(edit({ gstin: '29ABCDE1234F1Z5', entityType: 'Private Limited' })).toEqual({
      gstin: '29ABCDE1234F1Z5',
      entityType: 'Private Limited',
    })
  })

  it('clears fields with an empty string or null', () => {
    expect(edit({ contactEmail: '', foundedYear: '', logo: null })).toEqual({
      contactEmail: '',
      foundedYear: null,
      branding: { logo: '' },
    })
  })

  it('sends changed bank keys, keeping the account number as typed', () => {
    const base = fromStoredOrganization(stored)
    expect(
      edit({ bank: { ...base.bank, accountNumber: '0012 3456', upiId: 'zzz@icici' } }),
    ).toEqual({ accountDetails: { accountNumber: '00123456', upiId: 'zzz@icici' } })
  })

  it('sends changed branding, leaving other QR and social keys alone', () => {
    const base = fromStoredOrganization(stored)
    expect(
      edit({
        primary: '#abc',
        font: 'Open Sans',
        qr: { ...base.qr, logo: false },
        logo: { name: 'new.png', dataUrl: 'data:image/png;base64,AAAA' },
        socials: { ...base.socials, instagram: '' },
      }),
    ).toEqual({
      branding: {
        logo: 'data:image/png;base64,AAAA',
        color: { primary: '#AABBCC' },
        font: 'OpenSans',
        qr: { logo: false },
      },
      socials: { instagram: '' },
    })
  })

  it('never sends an invalid colour', () => {
    expect(edit({ primary: 'notacolor' })).toEqual({})
  })
})

describe('toPreviewOrganization', () => {
  it('carries the whole form in the shape templates render', () => {
    expect(toPreviewOrganization(fromStoredOrganization(stored))).toMatchObject({
      id: 'zzz',
      name: 'ZZZ Studio',
      contactEmail: 'a@zzz.in',
      foundedYear: 2019,
      accountDetails: { accountName: 'ZZZ', accountNumber: '123456789012' },
      branding: {
        logo: 'https://zzz.example/logo.png',
        color: { primary: '#262626', accent: '#CD2D2D' },
        font: 'PlayfairDisplay',
      },
    })
  })

  it('leaves blank fields out and falls back to valid colours', () => {
    const preview = toPreviewOrganization({ ...emptyOrganization(), primary: 'nope' })

    expect(preview).not.toHaveProperty('accountDetails')
    expect(preview).not.toHaveProperty('contactEmail')
    expect(preview).toMatchObject({ branding: { color: { primary: '#111827' }, font: 'Exo2' } })
  })
})