export interface RecentDecor {
  id: string
  url: string
}

const RECENT_KEY = 'mdoc.decor.recent'
const MAX_RECENT = 8

export type DecorKind = 'none' | 'builtin' | 'upload' | 'url'

export function decorKind(value: string): DecorKind {
  const text = value.trim()
  if (text === '' || text === 'none') return 'none'
  if (text.startsWith('builtin:')) return 'builtin'
  if (text.startsWith('upload:')) return 'upload'
  return 'url'
}

export function loadRecentDecor(): RecentDecor[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is RecentDecor =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as RecentDecor).id === 'string' &&
        typeof (item as RecentDecor).url === 'string',
    )
  } catch {
    return []
  }
}

export function rememberDecor(upload: RecentDecor): RecentDecor[] {
  const next = [upload, ...loadRecentDecor().filter((item) => item.id !== upload.id)].slice(
    0,
    MAX_RECENT,
  )
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    return next
  }
  return next
}

export function describeDecor(value: string): string {
  switch (decorKind(value)) {
    case 'none':
      return ''
    case 'builtin':
      return value.trim().slice('builtin:'.length)
    case 'upload':
      return 'Uploaded image'
    default:
      return value.trim()
  }
}