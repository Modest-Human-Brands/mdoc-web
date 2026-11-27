/** The signing API's limits on the chain sent with `sign/prepare`. */
export const MAX_CHAIN_LENGTH = 10
export const MAX_CERT_HEX = 20_000

interface Node {
  tag: number
  /** Offsets in bytes: the whole element, then its contents. */
  start: number
  body: number
  end: number
}

export interface CertificateInfo {
  /** DER of the two names as hex, so they can be compared exactly. */
  issuer: string
  subject: string
  notAfter: Date | null
}

const SEQUENCE = 0x30
const EXPLICIT_VERSION = 0xa0
const UTC_TIME = 0x17

function bytesOf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

function nodeAt(bytes: Uint8Array, start: number): Node {
  const tag = bytes[start]
  let length = bytes[start + 1]
  if (tag === undefined || length === undefined) throw new Error('Truncated certificate.')
  let body = start + 2
  if (length & 0x80) {
    const count = length & 0x7f
    if (count === 0 || count > 3) throw new Error('Unsupported certificate length.')
    length = 0
    for (let i = 0; i < count; i++) length = length * 256 + (bytes[body++] ?? 0)
  }
  const end = body + length
  if (end > bytes.length) throw new Error('Truncated certificate.')
  return { tag, start, body, end }
}

function childrenOf(bytes: Uint8Array, parent: Node): Node[] {
  const children: Node[] = []
  for (let at = parent.body; at < parent.end;) {
    const child = nodeAt(bytes, at)
    children.push(child)
    at = child.end
  }
  return children
}

function timeOf(bytes: Uint8Array, node: Node): Date | null {
  const text = String.fromCharCode(...bytes.subarray(node.body, node.end))
  const full =
    node.tag === UTC_TIME ? `${Number(text.slice(0, 2)) < 50 ? '20' : '19'}${text}` : text
  const match = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(full)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)
}

/** Reads just enough of an X.509 certificate to follow its issuer chain. Null if unreadable. */
export function readCertificate(derHex: string): CertificateInfo | null {
  try {
    const bytes = bytesOf(derHex)
    const certificate = nodeAt(bytes, 0)
    const tbs = childrenOf(bytes, certificate)[0]
    if (certificate.tag !== SEQUENCE || tbs?.tag !== SEQUENCE) return null
    const fields = childrenOf(bytes, tbs)
    const skip = fields[0]?.tag === EXPLICIT_VERSION ? 1 : 0
    // serialNumber, signature, issuer, validity, subject
    const [, , issuer, validity, subject] = fields.slice(skip)
    if (!issuer || !validity || !subject) return null
    const hexOf = (node: Node) => derHex.slice(node.start * 2, node.end * 2).toLowerCase()
    const notAfter = childrenOf(bytes, validity)[1]
    return {
      issuer: hexOf(issuer),
      subject: hexOf(subject),
      notAfter: notAfter ? timeOf(bytes, notAfter) : null,
    }
  } catch {
    return null
  }
}

/**
 * MStudio returns every authority certificate on the computer. Only the ones linking the signer's
 * certificate upwards are wanted; the self-signed root is left out, as the server leaves it out too.
 */
export function issuerChain(leafHex: string, pool: readonly string[]): string[] {
  const leaf = readCertificate(leafHex)
  if (!leaf) return []
  const candidates = pool
    .filter((hex) => hex.length <= MAX_CERT_HEX)
    .flatMap((hex) => {
      const info = readCertificate(hex)
      return info ? [{ hex, info }] : []
    })

  const chain: string[] = []
  const visited = new Set<string>()
  let wanted = leaf.issuer
  while (!visited.has(wanted) && chain.length < MAX_CHAIN_LENGTH) {
    visited.add(wanted)
    const match = candidates.find((candidate) => candidate.info.subject === wanted)
    if (!match || match.info.issuer === match.info.subject) break
    chain.push(match.hex)
    wanted = match.info.issuer
  }
  return chain
}

/** "CN=Rhea Kapoor, O=Studio" → "Rhea Kapoor". Falls back to the whole name. */
export function commonName(distinguishedName: string): string {
  const match = /(?:^|,\s*)CN=("(?:[^"]|"")*"|[^,]+)/.exec(distinguishedName)
  const value = match?.[1]
  if (!value) return distinguishedName
  return value.startsWith('"') ? value.slice(1, -1).replaceAll('""', '"') : value.trim()
}