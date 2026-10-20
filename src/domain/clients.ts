export interface Client {
  id: string
  name: string
  email: string
  phone: string
  address: string
}

export type ClientDraft = Omit<Client, 'id'>

export const CLIENT_FIELDS = ['name', 'email', 'phone', 'address'] as const

export function emptyClient(): ClientDraft {
  return { name: '', email: '', phone: '', address: '' }
}

export function clientInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

export function clientSubtitle(client: ClientDraft): string {
  const place = client.address.split(',').pop()?.trim() ?? ''
  return [client.email.trim(), place].filter(Boolean).join(' · ')
}

export function recipientPatch(
  client: ClientDraft,
  keys: readonly string[],
): Record<string, string> {
  const patch: Record<string, string> = {}
  for (const key of CLIENT_FIELDS) {
    if (keys.includes(key)) patch[key] = client[key].trim()
  }
  return patch
}

export function coveredKeys(client: ClientDraft | null, keys: readonly string[]): string[] {
  if (!client) return []
  return CLIENT_FIELDS.filter((key) => keys.includes(key) && client[key].trim() !== '')
}