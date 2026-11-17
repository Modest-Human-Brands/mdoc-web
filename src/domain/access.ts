export interface Access {
  organizationId: string
  userId: string
  apiKey: string
}

export const ACCESS_KEY = 'mdoc.access'

export function emptyAccess(): Access {
  return { organizationId: '', userId: '', apiKey: '' }
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeAccess(input: Partial<Access> | null | undefined): Access {
  return {
    organizationId: clean(input?.organizationId),
    userId: clean(input?.userId),
    apiKey: clean(input?.apiKey),
  }
}

export function loadAccess(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Access {
  try {
    const raw = storage?.getItem(ACCESS_KEY)
    return raw ? normalizeAccess(JSON.parse(raw) as Partial<Access>) : emptyAccess()
  } catch {
    return emptyAccess()
  }
}

export function saveAccess(
  access: Access,
  storage: Pick<Storage, 'setItem'> | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(ACCESS_KEY, JSON.stringify(normalizeAccess(access)))
  } catch {}
}

export function clearAccess(
  storage: Pick<Storage, 'removeItem'> | undefined = safeStorage(),
): void {
  try {
    storage?.removeItem(ACCESS_KEY)
  } catch {}
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export type AccessErrors = Partial<Record<keyof Access, string>>

export function accessErrors(access: Access): AccessErrors {
  const errors: AccessErrors = {}
  if (access.organizationId.trim() !== '' && /\s/.test(access.organizationId.trim())) {
    errors.organizationId = 'Use the organization slug, without spaces'
  }
  if (access.userId.trim() === '') errors.userId = 'Enter your user id'
  if (access.apiKey.trim() === '') errors.apiKey = 'Enter the API key'
  return errors
}

export function isConnected(access: { userId?: string; apiKey?: string }): boolean {
  return Boolean(access.userId?.trim() && access.apiKey?.trim())
}

/** Only same-app paths are allowed as a return target after connecting. */
export function safeNext(value: unknown): string {
  return typeof value === 'string' && /^\/(?!\/)/.test(value) && !value.startsWith('/setup')
    ? value
    : '/'
}