<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 pt-0.5 text-sm font-semi-bold text-accent-400 outline-none hover:text-accent-500 focus-visible:shadow-focus-ring"
  >
    <Plus :size="16" :stroke-width="2" aria-hidden="true" />
    <slot />
  </button>
</template>