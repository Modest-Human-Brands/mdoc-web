import { onScopeDispose, ref } from 'vue'

import { fontsApi, type FontSummary } from '@/api'
import { DEFAULT_FONT, fontName } from '@/domain/organization'

export const FALLBACK_FONTS: FontSummary[] = [
  { family: DEFAULT_FONT, name: fontName(DEFAULT_FONT) },
]

export function useFonts() {
  const fonts = ref<FontSummary[]>(FALLBACK_FONTS)
  const loading = ref(false)
  const offline = ref(false)
  let controller: AbortController | undefined

  async function search(query = '') {
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    try {
      const q = query.trim()
      fonts.value = await fontsApi.list({ q: q || undefined, limit: 20 }, controller.signal)
      offline.value = false
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      fonts.value = FALLBACK_FONTS
      offline.value = true
    }
    loading.value = false
  }

  async function isKnown(family: string): Promise<boolean | null> {
    if (family === DEFAULT_FONT) return true
    try {
      const found = await fontsApi.list({ q: family, limit: 20 })
      return found.some((font) => font.family.toLowerCase() === family.toLowerCase())
    } catch {
      return null
    }
  }

  onScopeDispose(() => controller?.abort())

  return { fonts, loading, offline, search, isKnown }
}