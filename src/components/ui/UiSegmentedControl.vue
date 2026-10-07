<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'

const model = defineModel<T>({ required: true })

defineProps<{
  label?: string
  options: { value: T; label: string }[]
}>()

const id = useId()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span v-if="label" :id="id" class="text-sm font-semi-bold text-light-600">{{ label }}</span>
    <div
      role="radiogroup"
      :aria-labelledby="label ? id : undefined"
      class="flex gap-0.5 rounded-md border border-dark-600 bg-dark-500 p-0.75"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="model === option.value"
        class="h-8 flex-1 rounded-[6px] px-2 text-sm font-semi-bold outline-none transition-colors focus-visible:shadow-focus-ring"
        :class="
          model === option.value ? 'bg-dark-600 text-white' : 'text-light-400 hover:text-white'
        "
        @click="model = option.value"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>