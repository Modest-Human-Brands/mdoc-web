import { onScopeDispose, ref } from 'vue'

import { fontsApi, type FontSummary } from '@/api'
import { DEFAULT_FONT, fontName } from '@/domain/organization'

export const FALLBACK_FONTS: FontSummary[] = [
  { family: DEFAULT_FONT, name: fontName(DEFAULT_FONT) },
]

let featuredCache: FontSummary[] | null = null

export function resetFontCache(): void {
  featuredCache = null
}

export function useFonts() {
  const fonts = ref<FontSummary[]>(featuredCache ?? FALLBACK_FONTS)
  const loading = ref(false)
  const offline = ref(false)
  let controller: AbortController | undefined

  async function search(query = '') {
    const q = query.trim()
    if (q === '' && featuredCache) {
      fonts.value = featuredCache
      offline.value = false
      return
    }
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    try {
      const list = await fontsApi.list({ q: q || undefined, limit: 20 }, controller.signal)
      if (q === '') featuredCache = list
      fonts.value = list
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
    const cached = featuredCache?.some((font) => font.family.toLowerCase() === family.toLowerCase())
    if (cached) return true
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