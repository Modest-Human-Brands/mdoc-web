<script setup lang="ts">
import IconCheck from '~icons/lucide/check'
import IconFileText from '~icons/lucide/file-text'

defineProps<{
  title: string
  category: string
  active?: boolean
}>()
</script>

<template>
  <button
    type="button"
    class="flex flex-col gap-3 rounded-lg border bg-dark-500 p-2 text-left outline-none transition-shadow"
    :class="
      active
        ? 'border-accent-400 shadow-[inset_0_0_0_0.5px_var(--color-accent-400),var(--shadow-focus-ring)]'
        : 'border-dark-600 hover:border-light-400 focus-visible:shadow-focus-ring'
    "
    :aria-pressed="active"
  >
    <span class="relative flex h-37 w-full items-center justify-center rounded-md bg-dark-600">
      <slot name="thumbnail">
        <IconFileText class="size-16 text-light-500 [--icon-stroke:1]" aria-hidden="true" />
      </slot>
      <span
        v-if="active"
        class="absolute top-2 right-2 flex size-5.5 items-center justify-center rounded-full bg-accent-500 text-white"
      >
        <IconCheck class="size-3 [--icon-stroke:3]" aria-hidden="true" />
        <span class="sr-only">Selected</span>
      </span>
    </span>
    <span class="flex flex-col gap-0.5 px-1 pb-1">
      <span class="text-sm font-semi-bold text-white">{{ title }}</span>
      <span class="text-xs text-light-400">{{ category }}</span>
    </span>
  </button>
</template>