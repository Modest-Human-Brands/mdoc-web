<script setup lang="ts">
import IconPlus from '~icons/lucide/plus'
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 pt-0.5 text-sm font-semi-bold text-accent-400 outline-none hover:text-accent-500 focus-visible:shadow-focus-ring"
  >
    <IconPlus class="size-4" aria-hidden="true" />
    <slot />
  </button>
</template>