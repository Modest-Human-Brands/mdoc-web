import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { templatesApi, type PreviewVariant, type PreviewWarning } from '@/api'

import { errorMessage } from './useTemplates'

const DEBOUNCE_MS = 400
const MAX_CACHE = 20

interface Rendered {
  url: string
  pageCount: number
  warnings: PreviewWarning[]
}

export function base64ToBlob(base64: string, type = 'application/pdf'): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

export function usePreview(
  templateId: MaybeRefOrGetter<string | null>,
  variables: MaybeRefOrGetter<Record<string, unknown>>,
  variant: MaybeRefOrGetter<PreviewVariant> = 'filled',
) {
  const url = ref<string | null>(null)
  const pageCount = ref(1)
  const warnings = ref<PreviewWarning[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const cache = new Map<string, Rendered>()
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function show(rendered: Rendered) {
    url.value = rendered.url
    pageCount.value = rendered.pageCount
    warnings.value = rendered.warnings
    error.value = null
    loading.value = false
  }

  function remember(key: string, rendered: Rendered) {
    cache.set(key, rendered)
    if (cache.size > MAX_CACHE) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) {
        const evicted = cache.get(oldest)
        if (evicted && evicted.url !== url.value) URL.revokeObjectURL(evicted.url)
        cache.delete(oldest)
      }
    }
  }

  async function render(id: string, kind: PreviewVariant, vars: Record<string, unknown>) {
    const key = JSON.stringify([id, kind, vars])
    const hit = cache.get(key)
    if (hit) {
      show(hit)
      return
    }

    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = null
    try {
      const response = await templatesApi.preview(
        { templateId: id, variant: kind, variables: vars },
        { draft: true, signal: controller.signal },
      )
      const rendered: Rendered = {
        url: URL.createObjectURL(base64ToBlob(response.pdfBase64)),
        pageCount: Math.max(1, response.pageCount ?? 1),
        warnings: response.warnings ?? [],
      }
      remember(key, rendered)
      show(rendered)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      error.value = errorMessage(e)
      loading.value = false
    }
  }

  watch(
    () => [toValue(templateId), toValue(variant), JSON.stringify(toValue(variables))] as const,
    ([id, kind]) => {
      clearTimeout(timer)
      if (!id) {
        controller?.abort()
        url.value = null
        warnings.value = []
        loading.value = false
        error.value = null
        return
      }
      timer = setTimeout(() => void render(id, kind, toValue(variables)), DEBOUNCE_MS)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    clearTimeout(timer)
    controller?.abort()
    for (const { url: cached } of cache.values()) URL.revokeObjectURL(cached)
    cache.clear()
  })

  return { url, pageCount, warnings, loading, error }
}