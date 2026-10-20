<script setup lang="ts">
import { ref, watch } from 'vue'

import { documentsApi } from '@/api'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import { errorMessage } from '@/composables/useTemplates'

const MIN_REASON = 5

const props = defineProps<{ open: boolean; documentId: string; name: string }>()
const emit = defineEmits<{ close: []; voided: [] }>()

const reason = ref('')
const busy = ref(false)
const failure = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      reason.value = ''
      failure.value = null
    }
  },
)

async function confirm() {
  if (reason.value.trim().length < MIN_REASON) {
    failure.value = `Give a reason of at least ${MIN_REASON} characters.`
    return
  }
  busy.value = true
  failure.value = null
  try {
    await documentsApi.void(props.documentId, reason.value.trim())
    emit('voided')
    emit('close')
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog :open="open" title="Void this document?" @close="emit('close')">
    <p class="text-sm text-light-400">
      “{{ name }}” will be cancelled for every pending signer and stamped VOID. This can't be
      undone.
    </p>
    <UiTextField
      v-model="reason"
      label="Reason"
      multiline
      :rows="3"
      :error="failure ?? undefined"
    />
    <div class="flex justify-end gap-2">
      <UiButton variant="ghost" @click="emit('close')">Keep document</UiButton>
      <UiButton :disabled="busy" @click="confirm">{{
        busy ? 'Voiding…' : 'Void document'
      }}</UiButton>
    </div>
  </UiDialog>
</template>