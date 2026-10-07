import { describe, expect, it } from 'vite-plus/test'

import { buildMailto, formatBytes } from '../format'

describe('formatBytes', () => {
  it('uses B, KB and MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(86016)).toBe('84 KB')
    expect(formatBytes(1572864)).toBe('1.5 MB')
    expect(formatBytes(-1)).toBe('')
  })
})

describe('buildMailto', () => {
  it('encodes subject and body and keeps the address readable', () => {
    const link = buildMailto({
      to: 'accounts@chaitheory.in',
      cc: 'billing@example.com',
      subject: 'Invoice A&B · ₹48,000',
      body: 'Hi,\nThanks',
    })

    expect(link.startsWith('mailto:accounts@chaitheory.in?cc=billing%40example.com')).toBe(true)
    expect(link).toContain('subject=Invoice%20A%26B%20%C2%B7%20%E2%82%B948%2C000')
    expect(link).toContain('body=Hi%2C%0D%0AThanks')
  })

  it('omits empty parts', () => {
    expect(buildMailto({ to: 'a@b.co' })).toBe('mailto:a@b.co')
  })
})