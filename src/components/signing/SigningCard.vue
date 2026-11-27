<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  facts?: { label: string; value: string }[]
}>()
</script>

<template>
  <section class="flex w-full flex-col gap-4 rounded-2xl border border-dark-600 bg-dark-500 p-8">
    <p class="font-mono text-xs tracking-widest text-light-500 uppercase">{{ eyebrow }}</p>
    <h1 class="text-xl font-semi-bold break-words">{{ title }}</h1>
    <p class="text-base break-words text-light-600"><slot name="text" /></p>
    <dl
      v-if="facts?.some((fact) => fact.value)"
      class="flex flex-col gap-2 rounded-xl border border-dark-600 bg-overlay p-4"
    >
      <template v-for="fact in facts" :key="fact.label">
        <div v-if="fact.value" class="flex flex-col gap-1">
          <dt class="text-xs text-light-500">{{ fact.label }}</dt>
          <dd class="text-sm break-words">{{ fact.value }}</dd>
        </div>
      </template>
    </dl>
    <slot />
  </section>
</template>