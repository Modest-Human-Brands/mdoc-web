<script setup lang="ts">
import { useRouter } from 'vue-router'

import UiStepper from '@/components/ui/UiStepper.vue'
import { useActiveTemplate } from '@/composables/useTemplates'
import { STEPS, useWizardStore } from '@/stores/wizard'

defineProps<{
  /** Zero-based index of the current step. */
  step: number
  title: string
  subtitle: string
}>()

const router = useRouter()
const wizard = useWizardStore()
useActiveTemplate()

async function cancel() {
  wizard.reset()
  await router.push(STEPS[0].path)
}
</script>

<template>
  <div class="flex h-full min-h-0 gap-3 bg-dark-400 p-3">
    <section class="flex w-160 shrink-0 flex-col gap-6 px-8 py-6" aria-label="New document wizard">
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span
            class="flex size-6 items-center justify-center rounded-sm bg-white text-xs font-bold text-dark-400"
            aria-hidden="true"
          >
            M
          </span>
          <h1 class="text-base font-bold text-white">New document</h1>
        </div>
        <button
          type="button"
          class="text-sm font-bold text-light-400 outline-none hover:text-white focus-visible:shadow-focus-ring"
          @click="cancel"
        >
          Cancel
        </button>
      </header>

      <UiStepper :steps="STEPS.map((s) => s.label)" :current="step" />

      <div class="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pr-1">
        <div class="flex flex-col gap-1">
          <h2 class="text-xl font-bold tracking-tight text-white">{{ title }}</h2>
          <p class="text-sm text-light-400">{{ subtitle }}</p>
        </div>
        <slot />
      </div>

      <footer class="flex flex-col gap-4">
        <hr class="h-px border-0 bg-dark-600" />
        <div class="flex min-h-9.25 items-center justify-between gap-4">
          <p class="text-sm text-light-400" role="status"><slot name="note" /></p>
          <div class="flex items-center gap-2"><slot name="actions" /></div>
        </div>
      </footer>
    </section>

    <slot name="preview" />
  </div>
</template>