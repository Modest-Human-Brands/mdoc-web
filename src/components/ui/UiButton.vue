<script setup lang="ts">
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

withDefaults(
  defineProps<{
    variant?: ButtonVariant
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  { variant: 'primary', type: 'button', disabled: false },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center rounded-md text-sm font-semi-bold whitespace-nowrap transition-colors outline-none focus-visible:shadow-focus-ring"
    :class="[
      variant === 'ghost' ? 'px-4 py-2.5' : 'border px-6 py-2.5',
      disabled
        ? 'border-dark-600 bg-dark-500 text-light-400'
        : variant === 'primary'
          ? 'border-accent-500 bg-accent-500 text-white hover:border-accent-400 hover:bg-accent-400 active:border-accent-600 active:bg-accent-600'
          : variant === 'secondary'
            ? 'border-dark-600 bg-dark-500 text-light-600 hover:bg-dark-600'
            : 'text-light-500 hover:text-white',
    ]"
  >
    <slot />
  </button>
</template>