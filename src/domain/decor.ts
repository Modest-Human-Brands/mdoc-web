export interface RecentDecor {
  id: string
  url: string
}

export type DecorKind = 'none' | 'builtin' | 'upload' | 'url'

export function decorKind(value: string): DecorKind {
  const text = value.trim()
  if (text === '' || text === 'none') return 'none'
  if (text.startsWith('builtin:')) return 'builtin'
  if (text.startsWith('upload:')) return 'upload'
  return 'url'
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