<script setup lang="ts">
import IconCheck from '~icons/lucide/check'
import IconChevronDown from '~icons/lucide/chevron-down'
import { onClickOutside } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'

import { EDITABLE_STATUSES } from '@/domain/documents'

type EditableStatus = (typeof EDITABLE_STATUSES)[number]

const props = defineProps<{ status: string; disabled?: boolean }>()
const emit = defineEmits<{ change: [status: EditableStatus] }>()

const open = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
onClickOutside(root, () => (open.value = false))

function close() {
  open.value = false
  trigger.value?.focus()
}

function choose(next: EditableStatus) {
  close()
  if (next !== props.status) emit('change', next)
}
</script>

<template>
  <div ref="root" class="relative shrink-0" @keydown.esc="close">
    <button
      ref="trigger"
      type="button"
      class="flex h-7 items-center gap-1 rounded-full border border-dark-600 bg-dark-500 px-3 text-sm font-semi-bold outline-none enabled:hover:border-light-400 focus-visible:shadow-focus-ring disabled:opacity-40"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-label="`Status: ${status}`"
      @click="open = !open"
    >
      {{ status }}
      <IconChevronDown class="size-3" aria-hidden="true" />
    </button>
    <ul
      v-if="open"
      class="absolute top-8 right-0 z-10 flex w-40 flex-col gap-0.5 rounded-md border border-dark-600 bg-dark-500 p-1.5 shadow-toolbar"
      aria-label="Change status"
    >
      <li v-for="option in EDITABLE_STATUSES" :key="option">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-sm px-1 py-0.5 text-left text-sm outline-none hover:bg-dark-600 focus-visible:bg-dark-600"
          :class="option === status ? 'text-white' : 'text-light-600'"
          :aria-current="option === status || undefined"
          @click="choose(option)"
        >
          <IconCheck
            class="size-3.5"
            :class="option === status ? '' : 'invisible'"
            aria-hidden="true"
          />
          {{ option }}{{ option === status ? ' (current)' : '' }}
        </button>
      </li>
    </ul>
  </div>
</template>