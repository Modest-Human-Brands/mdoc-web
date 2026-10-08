<script setup lang="ts">
import IconCheck from '~icons/lucide/check'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconPlus from '~icons/lucide/plus'

defineProps<{
  title: string
  summary: string
  complete?: boolean
  expanded?: boolean
}>()
</script>

<template>
  <button
    type="button"
    :aria-expanded="expanded"
    class="flex h-11 w-full items-center gap-3 rounded-md border border-dark-600 bg-dark-500 p-3 text-left outline-none transition-colors hover:bg-dark-600 focus-visible:shadow-focus-ring"
  >
    <span
      class="flex size-5 shrink-0 items-center justify-center rounded-full"
      :class="
        complete
          ? 'bg-success-subtle text-success-500'
          : 'border-[1.5px] border-light-400 text-light-400'
      "
      aria-hidden="true"
    >
      <IconCheck v-if="complete" class="size-[11px] [--icon-stroke:2.6]" />
      <IconPlus v-else class="size-2.5 [--icon-stroke:2.5]" />
    </span>
    <span class="flex-1 text-sm font-semi-bold text-white">{{ title }}</span>
    <span class="text-xs text-light-400">{{ summary }}</span>
    <IconChevronRight
      class="size-3.5 text-light-400 transition-transform"
      :class="expanded ? 'rotate-90' : ''"
      aria-hidden="true"
    />
  </button>
</template>