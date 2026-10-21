const REVOKE_DELAY_MS = 1000

const holds = new Map<string, number>()

function isBlobUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith('blob:')
}

export function retainBlob(url: string | null | undefined) {
  if (!isBlobUrl(url)) return
  holds.set(url, (holds.get(url) ?? 0) + 1)
}

export function releaseBlob(url: string | null | undefined) {
  if (!isBlobUrl(url)) return
  const remaining = (holds.get(url) ?? 0) - 1
  if (remaining > 0) {
    holds.set(url, remaining)
    return
  }
  holds.delete(url)
  setTimeout(() => {
    if (!holds.has(url)) URL.revokeObjectURL(url)
  }, REVOKE_DELAY_MS)
}

export function createBlobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  retainBlob(url)
  return url
}

export function isBlobHeld(url: string): boolean {
  return holds.has(url)
}

export function resetBlobRegistry() {
  holds.clear()
}