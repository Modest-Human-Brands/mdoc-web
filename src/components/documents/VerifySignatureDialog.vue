<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'

import { signingApi } from '@/api'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import { errorMessage } from '@/composables/useTemplates'
import { verificationView, type VerificationView } from '@/domain/verification'

/** The signing API refuses anything larger. */
const MAX_BYTES = 25 * 1024 * 1024

const props = defineProps<{ open: boolean; documentId: string }>()
const emit = defineEmits<{ close: [] }>()

const file = shallowRef<File | null>(null)
const result = ref<VerificationView | null>(null)
const failure = ref<string | null>(null)
const busy = ref(false)
let ticket = 0

function reset() {
  ticket++
  file.value = null
  result.value = null
  failure.value = null
  busy.value = false
}

watch(() => props.open, reset)

function choose(picked: File | undefined) {
  if (!picked) return
  failure.value = null
  file.value = null
  if (picked.type !== 'application/pdf' && !picked.name.toLowerCase().endsWith('.pdf')) {
    failure.value = 'Choose a PDF file.'
  } else if (picked.size > MAX_BYTES) {
    failure.value = 'The PDF is larger than 25 MB.'
  } else {
    file.value = picked
  }
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  choose(input.files?.[0])
  input.value = ''
}

const zone = useTemplateRef<HTMLElement>('zone')
const { isOverDropZone } = useDropZone(zone, {
  onDrop: (files) => choose(files?.[0]),
})

async function verify() {
  if (!file.value || busy.value) return
  const mine = ticket
  busy.value = true
  failure.value = null
  try {
    const response = await signingApi.verifySignature(props.documentId, file.value)
    if (mine === ticket) result.value = verificationView(response)
  } catch (error) {
    if (mine === ticket) failure.value = errorMessage(error)
  } finally {
    if (mine === ticket) busy.value = false
  }
}

const title = computed(() => result.value?.title ?? 'Verify PDF signature')
</script>

<template>
  <UiDialog :open="open" :title="title" @close="emit('close')">
    <p class="text-sm text-light-500">
      {{ result?.text ?? 'Upload a signed PDF to check it hasn’t been altered since signing.' }}
    </p>

    <div
      v-if="result"
      class="flex flex-col items-center gap-1 rounded-md border border-dark-600 bg-dark-400 px-4 py-9 text-center"
      role="status"
    >
      <span
        class="text-sm font-semi-bold break-words"
        :class="result.intact ? 'text-success-500' : 'text-alert-500'"
      >
        {{ result.headline }}
      </span>
      <span v-for="line in result.details" :key="line" class="text-xs break-words text-light-500">
        {{ line }}
      </span>
    </div>

    <label
      v-show="!result"
      ref="zone"
      class="flex cursor-pointer flex-col items-center gap-1 rounded-md border bg-dark-400 px-4 py-9 text-center focus-within:shadow-focus-ring"
      :class="isOverDropZone ? 'border-accent-400' : 'border-dark-600'"
    >
      <input type="file" accept="application/pdf,.pdf" class="sr-only" @change="onInput" />
      <span class="text-sm font-semi-bold break-all">
        {{ file ? file.name : 'Drop a signed PDF here, or browse' }}
      </span>
      <span class="text-xs text-light-500">PDF files only</span>
    </label>

    <p v-if="failure" class="text-xs text-alert-400" role="alert">{{ failure }}</p>

    <div class="flex justify-end gap-2">
      <UiButton variant="secondary" @click="emit('close')">
        {{ result ? 'Close' : 'Cancel' }}
      </UiButton>
      <UiButton v-if="result" @click="reset">Verify another</UiButton>
      <UiButton v-else :disabled="!file || busy" @click="verify">
        {{ busy ? 'Verifying…' : 'Verify' }}
      </UiButton>
    </div>
  </UiDialog>
</template>