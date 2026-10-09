import { useTimeoutFn } from '@vueuse/core'
import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { templatesApi, type PreviewVariant, type PreviewWarning } from '@/api'

import { isHeld } from './previewStage'
import { errorMessage } from './useTemplates'

const DEBOUNCE_MS = 800
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
  flush: MaybeRefOrGetter<number> = 0,
) {
  const url = ref<string | null>(null)
  const pageCount = ref(1)
  const warnings = ref<PreviewWarning[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const cache = new Map<string, Rendered>()
  let controller: AbortController | undefined
  let disposed = false

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
        if (evicted && evicted.url !== url.value && !isHeld(evicted.url)) {
          URL.revokeObjectURL(evicted.url)
        }
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

  const requestKey = computed(() =>
    JSON.stringify([toValue(templateId), toValue(variant), toValue(variables)]),
  )

  let started = false
  const pending = useTimeoutFn(
    () => run(),
    () => (started ? DEBOUNCE_MS : 0),
    { immediate: false },
  )

  function run() {
    if (disposed) return
    const id = toValue(templateId)
    if (!id) {
      controller?.abort()
      url.value = null
      warnings.value = []
      loading.value = false
      error.value = null
      return
    }
    void render(id, toValue(variant), toValue(variables))
  }

  watch(
    requestKey,
    () => {
      if (toValue(templateId)) loading.value = true
      pending.start()
      started = true
    },
    { immediate: true },
  )

  watch(
    () => toValue(flush),
    () => {
      if (!pending.isPending.value) return
      pending.stop()
      run()
    },
  )

  onScopeDispose(() => {
    disposed = true
    pending.stop()
    controller?.abort()
    for (const { url: cached } of cache.values()) {
      if (!isHeld(cached)) URL.revokeObjectURL(cached)
    }
    cache.clear()
  })

  return { url, pageCount, warnings, loading, error }
}