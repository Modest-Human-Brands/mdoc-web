<script setup lang="ts" generic="T extends string">
import { ChevronDown } from 'lucide-vue-next'
import { useId } from 'vue'

const model = defineModel<T>({ required: true })

defineProps<{
  label: string
  options: readonly T[]
}>()

const id = useId()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <label :for="id" class="text-sm font-semi-bold text-light-600">{{ label }}</label>
    <div
      class="relative flex h-9.5 items-center rounded-md border border-dark-600 bg-dark-500 focus-within:border-accent-400 focus-within:shadow-[inset_0_0_0_0.5px_var(--color-accent-400),var(--shadow-focus-ring)]"
    >
      <select
        :id="id"
        v-model="model"
        class="size-full appearance-none rounded-md bg-transparent pr-8 pl-3 text-sm text-white outline-none"
      >
        <option v-for="option in options" :key="option" :value="option" class="bg-dark-500">
          {{ option }}
        </option>
      </select>
      <ChevronDown
        :size="14"
        :stroke-width="2"
        class="pointer-events-none absolute right-3 text-light-400"
        aria-hidden="true"
      />
    </div>
  </div>
</template>