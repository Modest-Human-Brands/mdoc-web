<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { onMounted, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'

import { documentsApi, type DocumentListItem } from '@/api'
import { boardColumn, canVoid, formatAgo, initialOf } from '@/domain/documents'
import { formatBytes } from '@/domain/format'

const props = defineProps<{ item: DocumentListItem; index: number; label: string }>()
const emit = defineEmits<{
  download: [item: DocumentListItem]
  print: [item: DocumentListItem]
  void: [item: DocumentListItem]
}>()

// The preview is fetched with the API key: an <img src> cannot send headers.
const blob = shallowRef<Blob | null>(null)
const url = useObjectUrl(blob)
onMounted(async () => {
  try {
    blob.value = await documentsApi.content(props.item.id, { type: 'image' })
  } catch {}
})

const TONES: Record<string, string> = {
  Draft: 'bg-info-600 text-white',
  Ready: 'bg-success-600 text-white',
  Sent: 'bg-info-600 text-white',
  'Partially Signed': 'bg-info-600 text-white',
  Signed: 'bg-success-600 text-white',
  Expired: 'bg-alert-600 text-white',
  Void: 'bg-alert-600 text-white',
}
const tone = () => TONES[boardColumn(props.item.status)] ?? 'bg-dark-600 text-white'
const pill = () => {
  const column = boardColumn(props.item.status)
  return column === 'Partially Signed' ? 'Partial' : column
}
const chip = 'rounded-sm bg-dark-400 px-1.5 py-0.5 text-xs font-semi-bold text-white'
const menuItem = 'rounded-sm px-2 py-1.5 text-left hover:bg-dark-600 disabled:opacity-40'
</script>

<template>
  <article
    class="flex flex-col overflow-hidden rounded-lg border border-dark-600 bg-dark-500 text-white"
  >
    <RouterLink :to="`/documents/${item.id}`" class="flex flex-col outline-none">
      <div class="relative aspect-[254/183] overflow-hidden bg-white">
        <img
          v-if="url"
          :src="url"
          :alt="`Preview of ${item.name}`"
          class="size-full object-cover object-top"
        />
        <span class="absolute top-2 left-2" :class="chip">#{{ index }}</span>
        <span class="absolute bottom-2 left-2" :class="chip">PDF</span>
      </div>
      <div class="flex flex-col gap-2 px-2.5 py-3">
        <div class="flex items-center gap-2">
          <h3 class="min-w-0 flex-1 truncate text-sm font-semi-bold">{{ item.name }}</h3>
          <span class="rounded-full px-2 py-0.5 text-xs font-semi-bold" :class="tone()">
            {{ pill() }}
          </span>
        </div>
        <p class="text-xs text-light-400">{{ label }}</p>
        <p class="flex gap-3 text-xs text-light-400">
          <span v-if="item.updatedAt ?? item.createdAt">{{
            formatAgo(item.updatedAt ?? item.createdAt)
          }}</span>
          <span>{{ formatBytes(item.sizeBytes ?? -1) }}</span>
        </p>
      </div>
    </RouterLink>
    <div class="mt-auto flex items-center justify-between gap-2 border-t border-dark-600 px-3 py-2">
      <span
        v-if="item.contact"
        class="flex size-6 items-center justify-center rounded-full bg-dark-600 text-xs font-semi-bold"
        :title="item.contact.name"
      >
        {{ initialOf(item.contact.name) }}
      </span>
      <span v-else />
      <div class="flex items-center gap-1">
        <details class="relative">
          <summary
            class="flex size-7 cursor-pointer list-none items-center justify-center rounded-md text-light-400 hover:text-white"
            aria-label="More actions"
          >
            ⋯
          </summary>
          <div
            class="absolute right-0 bottom-8 z-10 flex w-40 flex-col rounded-md border border-dark-600 bg-dark-500 p-1 text-sm shadow-toolbar"
          >
            <button type="button" :class="menuItem" @click="emit('download', item)">
              Download PDF
            </button>
            <button type="button" :class="menuItem" @click="emit('print', item)">Print PDF</button>
            <button
              type="button"
              :class="menuItem"
              :disabled="!canVoid(item.status)"
              @click="emit('void', item)"
            >
              Void
            </button>
          </div>
        </details>
        <RouterLink
          :to="`/documents/${item.id}/send`"
          class="rounded-md bg-accent-500 px-2.5 py-1 text-xs font-semi-bold text-white hover:bg-accent-400"
        >
          Share
        </RouterLink>
      </div>
    </div>
  </article>
</template>