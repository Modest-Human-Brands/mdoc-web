<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { documentsApi } from '@/api'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import { errorMessage } from '@/composables/useTemplates'

const MIN_REASON = 5
const MAX_REASON = 500

const props = defineProps<{ open: boolean; documentId: string }>()
const emit = defineEmits<{ close: []; voided: [] }>()

const reason = ref('')
const busy = ref(false)
const failure = ref<string | null>(null)
const length = computed(() => reason.value.trim().length)

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
  if (length.value < MIN_REASON || busy.value) return
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
    <p class="text-sm text-light-500">
      Pending signers will be cancelled and a VOID watermark is added. This can't be undone.
    </p>
    <div class="flex flex-col gap-2">
      <textarea
        v-model="reason"
        rows="3"
        :maxlength="MAX_REASON"
        aria-label="Reason for voiding"
        placeholder="Reason for voiding (required)"
        class="resize-none rounded-md border border-dark-600 bg-dark-400 p-3 text-sm outline-none placeholder:text-light-500 focus:border-accent-400"
      />
      <p class="text-xs text-light-500">{{ length }} / {{ MIN_REASON }} characters minimum</p>
      <p v-if="failure" class="text-xs text-alert-400" role="alert">{{ failure }}</p>
    </div>
    <div class="flex justify-end gap-2">
      <UiButton variant="secondary" @click="emit('close')">Keep document</UiButton>
      <UiButton :disabled="busy || length < MIN_REASON" @click="confirm">
        {{ busy ? 'Voiding…' : 'Void document' }}
      </UiButton>
    </div>
  </UiDialog>
</template>