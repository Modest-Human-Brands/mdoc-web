import { useTimeoutFn } from '@vueuse/core'

export function safeFileName(name: string, fallback = 'document'): string {
  const cleaned = name
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned === '' ? fallback : cleaned
}

export function pdfFileName(name: string): string {
  const base = safeFileName(name).replace(/\.pdf$/i, '')
  return `${base}.pdf`
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  useTimeoutFn(() => URL.revokeObjectURL(url), 10_000)
}

export async function blobFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed (${response.status}).`)
  return await response.blob()
}