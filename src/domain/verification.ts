import type { VerifySignatureResponse } from '@/api'

export interface VerificationView {
  intact: boolean
  title: string
  text: string
  headline: string
  details: string[]
}

function listOf(names: string[]): string {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function verificationView(result: VerifySignatureResponse): VerificationView {
  const checks = result.signatures ?? []
  const names = [
    ...new Set(checks.length > 0 ? checks.map((check) => check.signer) : [result.signer]),
  ].filter((name): name is string => Boolean(name))
  const who = listOf(names) || 'an unknown signer'
  const subjects = names.map((name) => `CN=${name}`).join(', ')
  const expired = checks.some((check) => check.certificateExpired)
    ? ['A signing certificate has since expired.']
    : []

  if (result.isIntact === true) {
    return {
      intact: true,
      title: 'Signature intact',
      text: 'This PDF has not been altered since it was signed.',
      headline: `Intact · signed by ${who}`,
      details: [...(subjects ? [`Certificate subject: ${subjects}`] : []), ...expired],
    }
  }
  const appended = checks.length > 0 && checks.every((check) => check.valid)
  return {
    intact: false,
    title: 'Signature tampered',
    text: 'The document was changed after signing. Don’t rely on this copy.',
    headline: appended
      ? 'Tampered · content was added after signing'
      : 'Tampered · signature does not match',
    details: [`Signer: ${who}${subjects ? ` · ${subjects}` : ''}`, ...expired],
  }
}