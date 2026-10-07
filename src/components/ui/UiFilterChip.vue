<script setup lang="ts">
defineProps<{
  label: string
  count?: number
  selected?: boolean
}>()
</script>

<template>
  <button
    type="button"
    class="rounded-full px-3 py-1.5 text-xs font-semi-bold outline-none transition-colors focus-visible:shadow-focus-ring"
    :class="
      selected
        ? 'bg-white text-dark-400'
        : 'border border-dark-600 text-light-500 hover:border-light-400 hover:text-white'
    "
    :aria-pressed="selected"
  >
    {{ count === undefined ? label : `${label} ${count}` }}
  </button>
</template>