import { onMounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useRouter } from 'vue-router'

import {
  ApiError,
  fetchTemplateDetail,
  templatesApi,
  type TemplateDetail,
  type TemplateSummary,
} from '@/api'
import { STEPS, useWizardStore } from '@/stores/wizard'

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

export function useTemplateDetail(id: MaybeRefOrGetter<string | null>) {
  const detail = ref<TemplateDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const status = ref<number | null>(null)
  let latest = 0

  async function load(templateId: string | null) {
    const ticket = ++latest
    error.value = null
    status.value = null
    if (!templateId) {
      detail.value = null
      loading.value = false
      return
    }
    loading.value = true
    try {
      const loaded = await fetchTemplateDetail(templateId)
      if (ticket === latest) detail.value = loaded
    } catch (e) {
      if (ticket === latest) {
        error.value = errorMessage(e)
        status.value = e instanceof ApiError ? e.status : null
      }
    } finally {
      if (ticket === latest) loading.value = false
    }
  }

  watch(() => toValue(id), load, { immediate: true })

  return { detail, loading, error, status }
}

export function useActiveTemplate() {
  const wizard = useWizardStore()
  const router = useRouter()
  const result = useTemplateDetail(() => wizard.templateId)

  watch(
    result.detail,
    (detail) => {
      if (detail && detail.id === wizard.templateId) {
        wizard.applyTemplate(detail)
        void wizard.prefillNumber()
      }
    },
    { immediate: true },
  )

  watch(
    [result.error, result.status],
    ([error, status]) => {
      if (!error || !wizard.templateId) {
        wizard.templateError = null
        return
      }
      if (status === 404) {
        wizard.selectTemplate(null)
        void router.replace(STEPS[0].path)
        return
      }
      wizard.templateError = error
    },
    { immediate: true },
  )
  return result
}