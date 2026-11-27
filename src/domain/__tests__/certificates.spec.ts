import { describe, expect, it } from 'vite-plus/test'

import { commonName, issuerChain, MAX_CHAIN_LENGTH, readCertificate } from '../certificates'

const byte = (value: number) => value.toString(16).padStart(2, '0')

/** A minimal DER element; long lengths use the two-byte form. */
function der(tag: number, body: string): string {
  const length = body.length / 2
  const encoded =
    length < 128 ? byte(length) : `82${byte(Math.floor(length / 256))}${byte(length % 256)}`
  return `${byte(tag)}${encoded}${body}`
}

const ascii = (text: string) => Array.from(text, (char) => byte(char.charCodeAt(0))).join('')
const name = (text: string) => der(0x30, der(0x0c, ascii(text)))

/** Only the shape that is read: version, serial, algorithm, issuer, validity, subject. */
function certificate(subject: string, issuer: string, padding = 0): string {
  const validity = der(0x30, der(0x17, ascii('260101000000Z')) + der(0x17, ascii('270101000000Z')))
  const tbs = der(
    0x30,
    der(0xa0, der(0x02, '02')) +
      der(0x02, '01') +
      der(0x30, '') +
      name(issuer) +
      validity +
      name(subject) +
      der(0x04, '00'.repeat(padding)),
  )
  return der(0x30, tbs)
}

describe('certificates', () => {
  const leaf = certificate('Signer', 'Issuing CA', 200)
  const issuing = certificate('Issuing CA', 'Sub CA')
  const sub = certificate('Sub CA', 'Root')
  const root = certificate('Root', 'Root')
  const unrelated = certificate('Other CA', 'Root')

  it('reads names and expiry', () => {
    const info = readCertificate(leaf)
    expect(info?.subject).toBe(name('Signer'))
    expect(info?.issuer).toBe(name('Issuing CA'))
    expect(info?.notAfter?.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(readCertificate('3003020101')).toBeNull()
    expect(readCertificate('zz')).toBeNull()
  })

  it('keeps only the intermediates above the signer, in order and without the root', () => {
    expect(issuerChain(leaf, [unrelated, root, sub, 'abcd', issuing, issuing])).toEqual([
      issuing,
      sub,
    ])
    expect(issuerChain(leaf, [unrelated, root])).toEqual([])
  })

  it('stops on loops and at the server limit', () => {
    const a = certificate('Issuing CA', 'B')
    const b = certificate('B', 'Issuing CA')
    expect(issuerChain(leaf, [a, b])).toEqual([a, b])

    const long = Array.from({ length: 15 }, (_, i) =>
      certificate(i === 0 ? 'Issuing CA' : `CA ${i}`, `CA ${i + 1}`),
    )
    expect(issuerChain(leaf, long)).toHaveLength(MAX_CHAIN_LENGTH)
  })

  it('picks the common name', () => {
    expect(commonName('C=IN, O=Studio, CN=Rhea Kapoor')).toBe('Rhea Kapoor')
    expect(commonName('CN="Kapoor, Rhea", O=Studio')).toBe('Kapoor, Rhea')
    expect(commonName('O=Studio')).toBe('O=Studio')
  })
})