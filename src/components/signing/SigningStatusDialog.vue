<script setup lang="ts">
import { computed } from 'vue'

import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'

const props = defineProps<{
  /** idle keeps the dialog closed. */
  state: 'idle' | 'signing' | 'failed'
  step: 1 | 2
  error: string | null
  /** The key is on the signer's USB token, not on the server. */
  usb?: boolean
}>()
const emit = defineEmits<{ close: []; retry: [] }>()

const STEPS = computed(() =>
  props.usb
    ? (['Preparing your signature', 'Waiting for your token'] as const)
    : (['Preparing your signature', 'Preparing signed PDF'] as const),
)
const failed = computed(() => props.state === 'failed')
</script>

<template>
  <UiDialog
    :open="state !== 'idle'"
    :title="failed ? 'Signing failed' : 'Signing…'"
    @close="failed && emit('close')"
  >
    <p class="text-sm text-light-500">
      {{
        failed
          ? 'We couldn’t apply the signature. Your document is unchanged.'
          : usb
            ? 'Signing with your USB token. Enter your PIN in the Windows prompt.'
            : 'Applying your digital signature on the server. Please keep this window open.'
      }}
    </p>
    <div
      class="flex flex-col items-center gap-1 rounded-md border border-dark-600 bg-dark-400 px-4 py-9 text-center"
      :role="failed ? 'alert' : 'status'"
    >
      <template v-if="failed">
        <span class="text-sm font-semi-bold text-alert-500">Signature could not be applied</span>
        <span class="text-xs text-light-500">{{ error ?? 'Try again in a moment.' }}</span>
      </template>
      <template v-else>
        <span class="text-sm font-semi-bold text-light-600">Signing…</span>
        <span class="text-xs text-light-500">Step {{ step }} of 2 · {{ STEPS[step - 1] }}</span>
      </template>
    </div>
    <div v-if="failed" class="flex justify-end gap-2">
      <UiButton variant="secondary" @click="emit('close')">Close</UiButton>
      <UiButton @click="emit('retry')">Try again</UiButton>
    </div>
  </UiDialog>
</template>