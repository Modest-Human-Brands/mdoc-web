<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { documentsApi } from '@/api'
import UiButton from '@/components/ui/UiButton.vue'
import WizardPreview from '@/components/wizard/WizardPreview.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { errorMessage } from '@/composables/useTemplates'
import { blobFromUrl, pdfFileName, saveBlob } from '@/domain/download'
import { formatBytes } from '@/domain/format'
import { buildReview, organizationReview } from '@/domain/review'
import { STEPS, useWizardStore } from '@/stores/wizard'

const router = useRouter()
const wizard = useWizardStore()

const label = computed(() => wizard.template?.label ?? 'Document')
const fileName = computed(() => (wizard.document ? pdfFileName(wizard.document.name) : ''))
const meta = computed(() =>
  `A4 · ${formatBytes(wizard.document?.sizeBytes ?? -1)}`.replace(/ · $/, ''),
)

const sections = computed(() => [
  ...(wizard.schema ? buildReview(wizard.schema, wizard.values) : []),
  organizationReview(wizard.organization),
])

const downloading = ref(false)
const downloadError = ref<string | null>(null)

async function download() {
  if (!wizard.document) return
  downloading.value = true
  downloadError.value = null
  try {
    const url = documentsApi.contentUrl(wizard.document.id, { download: true })
    saveBlob(await blobFromUrl(url), fileName.value)
  } catch (error) {
    downloadError.value = errorMessage(error)
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <WizardShell
    :step="3"
    title="Review and download"
    subtitle="This is exactly what went into the PDF. Go back to change anything."
  >
    <div class="flex h-16.5 items-center gap-3 rounded-lg border border-dark-600 bg-dark-500 p-3">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-md bg-dark-600 text-2xs font-bold tracking-wide text-light-600"
        aria-hidden="true"
      >
        PDF
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-sm font-semi-bold text-white">{{ fileName }}</span>
        <span class="text-xs text-light-400">{{ meta }}</span>
      </span>
    </div>

    <p
      v-if="downloadError"
      class="rounded-md bg-alert-600 px-3 py-2 text-sm text-white"
      role="alert"
    >
      Download failed: {{ downloadError }}
    </p>

    <section
      v-for="section in sections"
      :key="section.title"
      class="flex flex-col gap-2"
      :aria-label="section.title"
    >
      <h3 class="text-xs tracking-[0.06em] text-light-400 uppercase">{{ section.title }}</h3>
      <dl class="flex flex-col rounded-lg border border-dark-600 bg-dark-500">
        <div
          v-for="row in section.rows"
          :key="row.label"
          class="flex gap-4 border-b border-dark-600 px-3 py-2.5 last:border-b-0"
        >
          <dt class="w-36 shrink-0 text-sm text-light-400">{{ row.label }}</dt>
          <dd class="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap text-white">
            {{ row.value }}
          </dd>
        </div>
      </dl>
    </section>

    <template #note>{{ `${label} ready to download` }}</template>
    <template #actions>
      <UiButton variant="ghost" @click="router.push(STEPS[2].path)">Back</UiButton>
      <UiButton :disabled="!wizard.document || downloading" @click="download">
        {{ downloading ? 'Downloading…' : 'Download PDF' }}
      </UiButton>
    </template>

    <template #preview>
      <WizardPreview :label="`Final preview · ${label}`" />
    </template>
  </WizardShell>
</template>