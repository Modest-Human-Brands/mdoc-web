<script setup lang="ts">
import { computed, watch } from 'vue'

import { documentsApi } from '@/api'
import { usePreview } from '@/composables/usePreview'
import { useWizardStore } from '@/stores/wizard'

import PreviewPanel from './PreviewPanel.vue'

defineProps<{ label: string }>()

const wizard = useWizardStore()

const previewTemplate = computed(() => (wizard.schema ? wizard.templateId : null))
const { url, pageCount, warnings, loading, error } = usePreview(
  previewTemplate,
  () => wizard.previewVariables,
)

watch(warnings, (list) => wizard.setPreviewWarnings(list), { immediate: true })
watch(
  [url, loading, error, pageCount],
  () =>
    (wizard.preview = {
      loading: loading.value,
      error: error.value,
      ready: url.value !== null,
      pageCount: pageCount.value,
    }),
  { immediate: true },
)

const fetchDownload = computed(() => {
  const document = wizard.document
  return document ? () => documentsApi.content(document.id) : undefined
})

const downloadName = computed(
  () => wizard.document?.name ?? `${wizard.template?.shortLabel ?? 'Document'} draft`,
)
</script>

<template>
  <PreviewPanel
    :label="label"
    :reset-key="wizard.templateId"
    :url="url"
    :loading="loading"
    :error="error"
    :fetch-download="fetchDownload"
    :download-name="downloadName"
  />
</template>