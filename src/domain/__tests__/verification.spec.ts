import { describe, expect, it } from 'vite-plus/test'

import { verificationView } from '../verification'

const check = (signer: string, valid = true) => ({ signer, valid, coversToEnd: true })

describe('verificationView', () => {
  it('names everyone who signed an intact file', () => {
    const view = verificationView({
      isIntact: true,
      signer: 'Arjun',
      signatures: [check('Rhea'), check('Arjun')],
      message: '',
    })

    expect(view.title).toBe('Signature intact')
    expect(view.headline).toBe('Intact · signed by Rhea and Arjun')
    expect(view.details).toEqual(['Certificate subject: CN=Rhea, CN=Arjun'])
  })

  it('separates a broken signature from content added afterwards', () => {
    const broken = verificationView({
      isIntact: false,
      signatures: [check('Rhea', false)],
      message: '',
    })
    const appended = verificationView({
      isIntact: false,
      signatures: [{ ...check('Rhea'), coversToEnd: false, certificateExpired: true }],
      message: '',
    })

    expect(broken.headline).toBe('Tampered · signature does not match')
    expect(broken.details).toEqual(['Signer: Rhea · CN=Rhea'])
    expect(appended.headline).toBe('Tampered · content was added after signing')
    expect(appended.details).toContain('A signing certificate has since expired.')
  })
})