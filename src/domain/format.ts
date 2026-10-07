/** 86016 gives "84 KB"; 1572864 gives "1.5 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  return `${Number(mb.toFixed(1))} MB`
}

export interface MailtoParts {
  to: string
  cc?: string
  subject?: string
  body?: string
}

/**
 * Builds a `mailto:` link. Uses %0D%0A for line breaks, which mail clients expect, and encodes
 * every part so commas, ampersands and non-ASCII text (e.g. ₹) survive.
 */
export function buildMailto({ to, cc, subject, body }: MailtoParts): string {
  const params: string[] = []
  if (cc) params.push(`cc=${encodeURIComponent(cc)}`)
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) params.push(`body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`)
  return `mailto:${encodeURIComponent(to).replace(/%40/g, '@').replace(/%2C/gi, ',')}${
    params.length > 0 ? `?${params.join('&')}` : ''
  }`
}