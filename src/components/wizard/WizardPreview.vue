<script setup lang="ts">
import { computed, watch } from 'vue'

import { documentsApi } from '@/api'
import { usePreview } from '@/composables/usePreview'
import { useWizardStore } from '@/stores/wizard'

import PreviewPanel from './PreviewPanel.vue'

defineProps<{ label: string }>()

const wizard = useWizardStore()

// Hold the request until the schema is known: placeholders come from it.
const previewTemplate = computed(() => (wizard.schema ? wizard.templateId : null))
const { url, pages, loading, error, fields } = usePreview(
  previewTemplate,
  () => wizard.previewVariables,
)

// Mark the inputs the server rejected while previewing.
watch(fields, (list) => wizard.setPreviewErrors(list))

const downloadUrl = computed(() =>
  wizard.document ? documentsApi.contentUrl(wizard.document.id, { download: true }) : null,
)
</script>

<template>
  <PreviewPanel
    :label="label"
    :url="url"
    :pages="pages"
    :loading="loading"
    :error="error"
    :download-url="downloadUrl"
    :download-name="wizard.document ? `${wizard.document.name}.pdf` : undefined"
  />
</template>