<script setup lang="ts">
import { computed, useId } from 'vue'

const model = defineModel<string>({ required: true })

defineProps<{ label: string }>()

const id = useId()
const isHex = computed(() => /^#[0-9a-f]{6}$/i.test(model.value))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <label :for="id" class="text-sm font-semi-bold text-light-600">{{ label }}</label>
    <div
      class="flex h-9.5 items-center gap-2 rounded-md border border-dark-600 bg-dark-500 px-2 focus-within:border-accent-400 focus-within:shadow-[inset_0_0_0_0.5px_var(--color-accent-400),var(--shadow-focus-ring)]"
    >
      <span class="relative size-5.5 shrink-0 overflow-hidden rounded-sm border border-dark-600">
        <span
          class="absolute inset-0"
          :style="{ backgroundColor: isHex ? model : 'transparent' }"
        />
        <input
          type="color"
          :value="isHex ? model : '#000000'"
          class="absolute inset-0 size-full cursor-pointer opacity-0"
          :aria-label="`${label} colour picker`"
          @input="model = ($event.target as HTMLInputElement).value.toUpperCase()"
        />
      </span>
      <input
        :id="id"
        v-model="model"
        maxlength="7"
        spellcheck="false"
        class="min-w-0 flex-1 bg-transparent text-sm uppercase text-white outline-none"
      />
    </div>
  </div>
</template>