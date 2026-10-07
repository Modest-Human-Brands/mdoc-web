import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { ApiError, templatesApi, type FieldError } from '@/api'

import { errorMessage } from './useTemplates'

interface PreviewResult {
  url: string
  pages: number
}

const DEBOUNCE_MS = 400
const MAX_CACHE = 20

export function base64ToBlob(base64: string, type = 'application/pdf'): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

/** Counts `/Type /Page` objects (not `/Pages`); good enough for the page rail. */
export function countPdfPages(bytes: string): number {
  const matches = bytes.match(/\/Type\s*\/Page(?![s\w])/g)
  return Math.max(1, matches?.length ?? 1)
}

/**
 * Debounced server-rendered preview. A new request aborts the previous one, identical inputs are
 * served from a small cache, and the last good PDF stays visible while the next one loads.
 */
export function usePreview(
  templateId: MaybeRefOrGetter<string | null>,
  variables: MaybeRefOrGetter<Record<string, unknown>>,
) {
  const url = ref<string | null>(null)
  const pages = ref(1)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Per-field problems from a 400, so the form can mark the inputs. */
  const fields = ref<FieldError[]>([])

  const cache = new Map<string, PreviewResult>()
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function remember(key: string, result: PreviewResult) {
    cache.set(key, result)
    if (cache.size > MAX_CACHE) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) {
        const evicted = cache.get(oldest)
        // Never revoke the URL that is currently displayed.
        if (evicted && evicted.url !== url.value) URL.revokeObjectURL(evicted.url)
        cache.delete(oldest)
      }
    }
  }

  async function render(id: string, vars: Record<string, unknown>) {
    const key = JSON.stringify([id, vars])
    const hit = cache.get(key)
    if (hit) {
      url.value = hit.url
      pages.value = hit.pages
      error.value = null
      loading.value = false
      return
    }

    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = null
    fields.value = []
    try {
      const { pdfBase64 } = await templatesApi.preview(
        { templateId: id, variables: vars },
        controller.signal,
      )
      const blob = base64ToBlob(pdfBase64)
      const result = {
        url: URL.createObjectURL(blob),
        pages: countPdfPages(atob(pdfBase64)),
      }
      remember(key, result)
      url.value = result.url
      pages.value = result.pages
      loading.value = false
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      error.value = errorMessage(e)
      fields.value = e instanceof ApiError ? e.fields : []
      loading.value = false
    }
  }

  watch(
    () => [toValue(templateId), JSON.stringify(toValue(variables))] as const,
    ([id]) => {
      clearTimeout(timer)
      if (!id) {
        controller?.abort()
        url.value = null
        loading.value = false
        error.value = null
        return
      }
      timer = setTimeout(() => void render(id, toValue(variables)), DEBOUNCE_MS)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    clearTimeout(timer)
    controller?.abort()
    for (const { url: cached } of cache.values()) URL.revokeObjectURL(cached)
    cache.clear()
  })

  return { url, pages, loading, error, fields }
}