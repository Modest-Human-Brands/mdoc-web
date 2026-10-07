import { onMounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { ApiError, templatesApi, type TemplateDetail, type TemplateSummary } from '@/api'
import { useWizardStore } from '@/stores/wizard'

export function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong.'
}

export function useTemplates() {
  const templates = ref<TemplateSummary[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      templates.value = await templatesApi.list()
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  return { templates, loading, error, reload: load }
}

const detailCache = new Map<string, TemplateDetail>()
const inflight = new Map<string, Promise<TemplateDetail>>()

/** Cached, de-duplicated fetch: concurrent callers for one id share a single request. */
function fetchDetail(id: string): Promise<TemplateDetail> {
  const cached = detailCache.get(id)
  if (cached) return Promise.resolve(cached)
  const pending = inflight.get(id)
  if (pending) return pending

  const request = templatesApi
    .get(id)
    .then((loaded) => {
      detailCache.set(id, loaded)
      return loaded
    })
    .finally(() => inflight.delete(id))
  inflight.set(id, request)
  return request
}

/** Loads one template's variables/signer fields; results are cached for the session. */
export function useTemplateDetail(id: MaybeRefOrGetter<string | null>) {
  const detail = ref<TemplateDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let latest = 0

  async function load(templateId: string | null) {
    const ticket = ++latest
    error.value = null
    if (!templateId) {
      detail.value = null
      loading.value = false
      return
    }
    loading.value = true
    try {
      const loaded = await fetchDetail(templateId)
      if (ticket === latest) detail.value = loaded
    } catch (e) {
      if (ticket === latest) error.value = errorMessage(e)
    } finally {
      if (ticket === latest) loading.value = false
    }
  }

  watch(() => toValue(id), load, { immediate: true })

  return { detail, loading, error }
}

/** Keeps the store's schema and form defaults in sync with the selected template. */
export function useActiveTemplate() {
  const wizard = useWizardStore()
  const result = useTemplateDetail(() => wizard.templateId)
  watch(
    result.detail,
    (detail) => {
      if (detail && detail.id === wizard.templateId) wizard.applyTemplate(detail)
    },
    { immediate: true },
  )
  return result
}