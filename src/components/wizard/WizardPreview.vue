<script setup lang="ts">
import { computed, watch, watchEffect } from 'vue'

import { documentsApi } from '@/api'
import { usePreview } from '@/composables/usePreview'
import { useWizardStore } from '@/stores/wizard'

import PreviewPanel from './PreviewPanel.vue'

const props = withDefaults(defineProps<{ label: string; variant?: 'branded' | 'filled' }>(), {
  variant: 'filled',
})

const wizard = useWizardStore()

const previewTemplate = computed(() => (wizard.schema ? wizard.templateId : null))
const { url, pageCount, warnings, loading, error } = usePreview(
  previewTemplate,
  () => (props.variant === 'branded' ? wizard.brandPreviewVariables : wizard.previewVariables),
  () => props.variant,
  () => wizard.previewFlushes,
)

watch(warnings, (list) => wizard.setPreviewWarnings(props.variant === 'filled' ? list : []), {
  immediate: true,
})
watchEffect(() => {
  wizard.preview = {
    loading: loading.value,
    error: error.value,
    ready: url.value !== null,
    pageCount: pageCount.value,
  }
})

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