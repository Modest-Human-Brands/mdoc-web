<script setup lang="ts">
import type { SignerQueueEntry } from '@/api'
import { initialOf, signerCaption, signerTag } from '@/domain/documents'

defineProps<{
  signers: SignerQueueEntry[]
  /** Position of the signer whose turn it is; -1 when nobody is next. */
  nextIndex: number
}>()
</script>

<template>
  <ul class="flex flex-col gap-3">
    <li v-for="(signer, index) in signers" :key="signer.email" class="flex items-center gap-3">
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-overlay text-xs font-semi-bold"
        aria-hidden="true"
      >
        {{ initialOf(signer.name || signer.email) }}
      </span>
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-sm font-semi-bold">{{ signer.name || signer.email }}</span>
        <span class="truncate text-xs text-light-500">
          {{ signerCaption(signer, signers[index - 1], index === nextIndex) }}
        </span>
      </span>
      <span class="shrink-0 rounded-full bg-overlay px-3 py-1 text-xs font-semi-bold">
        {{ signerTag(signer, index === nextIndex) }}
      </span>
    </li>
  </ul>
</template>