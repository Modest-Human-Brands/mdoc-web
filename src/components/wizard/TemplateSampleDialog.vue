<script setup lang="ts">
import { ref } from 'vue'

import { templatesApi } from '@/api'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import { base64ToBlob } from '@/composables/usePreview'
import { errorMessage } from '@/composables/useTemplates'
import { blobFromUrl, pdfFileName, saveBlob } from '@/domain/download'
import { useWizardStore } from '@/stores/wizard'

const props = defineProps<{
  open: boolean
  templateId: string | null
  name: string
  sampleUrl: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const wizard = useWizardStore()
const withBrand = ref(true)
const busy = ref(false)
const error = ref<string | null>(null)

async function download() {
  if (!props.templateId || busy.value) return
  busy.value = true
  error.value = null
  try {
    if (withBrand.value) {
      const response = await templatesApi.preview({
        templateId: props.templateId,
        variant: 'branded',
        variables: wizard.brandPreviewVariables,
      })
      saveBlob(base64ToBlob(response.pdfBase64), pdfFileName(`${props.name} sample`))
    } else if (props.sampleUrl) {
      saveBlob(await blobFromUrl(props.sampleUrl), pdfFileName(`${props.name} sample`))
    }
    emit('close')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog :open="open" title="Template sample" @close="emit('close')">
    <p class="text-sm text-light-600">
      Download a sample PDF, or preview this template with your brand.
    </p>
    <button
      type="button"
      role="switch"
      :aria-checked="withBrand"
      class="flex flex-col items-center gap-1 rounded-md border border-dark-600 px-4 py-8 text-center outline-none focus-visible:shadow-focus-ring"
      @click="withBrand = !withBrand"
    >
      <span class="text-sm font-semi-bold">
        Preview with my brand · {{ withBrand ? 'On' : 'Off' }}
      </span>
      <span class="text-xs text-light-400">Shows your logo, colours and font on the sample</span>
    </button>
    <p v-if="error" class="text-xs text-alert-400" role="alert">{{ error }}</p>
    <div class="flex justify-end gap-2">
      <UiButton variant="secondary" @click="emit('close')">Close</UiButton>
      <UiButton :disabled="busy || !templateId" @click="download">
        {{ busy ? 'Preparing…' : 'Download sample PDF' }}
      </UiButton>
    </div>
  </UiDialog>
</template>