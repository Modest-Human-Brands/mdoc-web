export function isHttpsUrl(input: string): boolean {
  try {
    return new URL(input.trim()).protocol === 'https:'
  } catch {
    return false
  }
}