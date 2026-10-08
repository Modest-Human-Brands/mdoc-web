<script setup lang="ts">
defineProps<{
  steps: string[]
  current: number
}>()
</script>

<template>
  <ol class="flex gap-3">
    <li v-for="(label, index) in steps" :key="label" class="flex flex-1 flex-col gap-2">
      <span
        class="h-1 rounded-full"
        :class="index <= current ? 'bg-accent-500' : 'bg-dark-600'"
        aria-hidden="true"
      />
      <span
        class="text-xs font-semi-bold"
        :class="index === current ? 'text-white' : 'text-light-400'"
        :aria-current="index === current ? 'step' : undefined"
      >
        {{ index < current ? '✓  ' : `${index + 1} ` }}{{ label }}
      </span>
    </li>
  </ol>
</template>