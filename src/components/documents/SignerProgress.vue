<script setup lang="ts">
import { computed } from 'vue'

import type { SignerQueueEntry } from '@/api'
import { signedCount } from '@/domain/documents'

import SignerList from './SignerList.vue'

const props = defineProps<{
  signers: SignerQueueEntry[]
  nextIndex: number
  voided?: boolean
}>()

const signed = computed(() => signedCount(props.signers))
const progress = computed(() =>
  props.voided || props.signers.length === 0
    ? 0
    : Math.round((signed.value / props.signers.length) * 100),
)
</script>

<template>
  <section class="flex flex-col gap-3" aria-label="Signers">
    <div class="flex items-center justify-between text-xs text-light-500">
      <span>{{ voided ? 'Voided · ' : '' }}{{ signed }} of {{ signers.length }} signed</span>
      <span>{{ voided ? '—' : `${progress}%` }}</span>
    </div>
    <div class="h-1.5 rounded-full bg-dark-600">
      <div class="h-full rounded-full bg-accent-500" :style="{ width: `${progress}%` }" />
    </div>
    <SignerList :signers="signers" :next-index="nextIndex" />
  </section>
</template>