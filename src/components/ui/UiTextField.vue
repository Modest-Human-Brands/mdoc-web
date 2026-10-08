<script setup lang="ts">
import { useId } from 'vue'

const model = defineModel<string>({ default: '' })

withDefaults(
  defineProps<{
    label: string
    hint?: string
    placeholder?: string
    suffix?: string
    badge?: string
    multiline?: boolean
    numeric?: boolean
    readonly?: boolean
    type?: 'text' | 'email' | 'tel' | 'date' | 'time' | 'number'
    rows?: number
    error?: string
  }>(),
  { type: 'text', rows: 5 },
)

const emit = defineEmits<{ badge: [] }>()
const id = useId()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <label :for="id" class="flex items-end gap-1.5 text-sm font-semi-bold text-light-600">
      {{ label }}
      <span v-if="hint" class="text-xs font-regular text-light-400">{{ hint }}</span>
    </label>
    <div
      class="flex gap-2 rounded-md border px-3 transition-shadow"
      :class="[
        multiline ? 'items-start py-2.5' : 'h-9.5 items-center',
        error
          ? 'border-alert-500 bg-dark-500'
          : readonly
            ? 'border-dark-600 bg-dark-400'
            : 'border-dark-600 bg-dark-500 focus-within:border-accent-400 focus-within:shadow-[inset_0_0_0_0.5px_var(--color-accent-400),var(--shadow-focus-ring)]',
      ]"
    >
      <textarea
        v-if="multiline"
        :id="id"
        v-model="model"
        :rows="rows"
        :placeholder="placeholder"
        :readonly="readonly"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="min-w-0 flex-1 resize-y bg-transparent text-sm text-white outline-none placeholder:text-light-400"
      />
      <input
        v-else
        :id="id"
        v-model="model"
        :type="type"
        :placeholder="placeholder"
        :readonly="readonly"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-light-400"
        :class="[numeric ? 'text-right' : '', readonly ? 'text-light-500' : 'text-white']"
      />
      <span v-if="suffix" class="shrink-0 text-xs text-light-400">{{ suffix }}</span>
      <button
        v-if="badge"
        type="button"
        class="shrink-0 rounded-sm bg-dark-600 px-2 py-0.5 text-xs font-semi-bold text-light-500 hover:text-white"
        @click="emit('badge')"
      >
        {{ badge }}
      </button>
    </div>
    <p v-if="error" :id="`${id}-error`" class="text-xs text-alert-400" role="alert">{{ error }}</p>
  </div>
</template>