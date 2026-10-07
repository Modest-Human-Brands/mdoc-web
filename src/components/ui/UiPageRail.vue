<script setup lang="ts">
const page = defineModel<number>({ default: 1 })

defineProps<{ pages: number }>()
</script>

<template>
  <nav
    class="flex w-12 flex-col items-center gap-1.5 rounded-lg border border-dark-600 bg-dark-500 px-2 py-2.5"
    aria-label="Pages"
  >
    <template v-for="n in pages" :key="n">
      <span
        v-if="n > 1"
        class="h-4 w-0.5 rounded-full"
        :class="page >= n ? 'bg-accent-500' : 'bg-dark-600'"
        aria-hidden="true"
      />
      <button
        type="button"
        class="flex flex-col items-center gap-1 outline-none focus-visible:shadow-focus-ring"
        :aria-label="`Page ${n}`"
        :aria-current="page === n ? 'page' : undefined"
        @click="page = n"
      >
        <span
          class="flex h-11 w-8 flex-col gap-0.75 rounded-[3px] border-2 bg-white p-1.25"
          :class="page === n ? 'border-accent-500' : 'border-dark-600 opacity-60'"
          aria-hidden="true"
        >
          <span class="h-0.5 w-3.5 bg-accent-500" />
          <span class="h-0.5 w-5.5 bg-light-600" />
          <span class="h-0.5 w-4.5 bg-light-600" />
        </span>
        <span
          class="text-2xs font-bold tracking-wide"
          :class="page === n ? 'text-white' : 'text-light-400'"
        >
          {{ n }}
        </span>
      </button>
    </template>
  </nav>
</template>