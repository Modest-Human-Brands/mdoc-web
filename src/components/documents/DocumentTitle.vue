<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue'

import { documentsApi } from '@/api'
import { errorMessage } from '@/composables/useTemplates'

const MAX_LENGTH = 200

const props = defineProps<{ documentId: string; name: string; editable: boolean }>()
const emit = defineEmits<{ renamed: [] }>()

const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const input = useTemplateRef<HTMLInputElement>('input')

watch(
  () => props.documentId,
  () => cancel(),
)

async function start() {
  draft.value = props.name
  error.value = null
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

function cancel() {
  editing.value = false
  error.value = null
}

async function save() {
  if (saving.value) return
  const name = draft.value.trim()
  if (name === '' || name === props.name) {
    cancel()
    return
  }
  saving.value = true
  error.value = null
  try {
    await documentsApi.update(props.documentId, { name })
    editing.value = false
    emit('renamed')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col gap-1">
    <div
      v-if="editing"
      class="flex h-9.5 items-center gap-2 rounded-md border border-accent-400 bg-dark-500 px-3"
    >
      <input
        ref="input"
        v-model="draft"
        :maxlength="MAX_LENGTH"
        :disabled="saving"
        aria-label="Document title"
        class="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
        @keydown.enter.prevent="save"
        @keydown.esc.prevent="cancel"
        @blur="!saving && !error && cancel()"
      />
      <span class="shrink-0 text-xs text-light-400">
        {{ saving ? 'Saving…' : 'Enter saves · Esc cancels' }}
      </span>
    </div>
    <h1 v-else class="min-w-0 text-lg font-semi-bold">
      <button
        v-if="editable"
        type="button"
        class="max-w-full cursor-text rounded-sm text-left break-words outline-none hover:bg-dark-500 focus-visible:shadow-focus-ring"
        title="Rename"
        @click="start"
      >
        {{ name }}
      </button>
      <span v-else class="break-words">{{ name }}</span>
    </h1>
    <p v-if="error" class="text-xs text-alert-400" role="alert">{{ error }}</p>
  </div>
</template>