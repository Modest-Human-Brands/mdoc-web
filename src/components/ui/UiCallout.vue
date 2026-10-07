<script setup lang="ts">
defineProps<{
  label: string
  value: string
}>()
</script>

<template>
  <div
    class="flex items-center justify-between rounded-md bg-success-surface px-4 py-3"
    role="status"
  >
    <span class="text-sm font-semi-bold text-light-600">{{ label }}</span>
    <span class="text-lg font-semi-bold text-success-500">{{ value }}</span>
  </div>
</template>