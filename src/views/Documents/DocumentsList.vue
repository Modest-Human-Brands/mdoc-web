<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { documentsApi, type DocumentListItem } from '@/api'
import VoidDialog from '@/components/documents/VoidDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiFilterChip from '@/components/ui/UiFilterChip.vue'
import { useDocumentList } from '@/composables/useDocuments'
import { errorMessage, useTemplates } from '@/composables/useTemplates'
import {
  formatDay,
  matchesSearch,
  pageRange,
  PAGE_SIZE,
  STATUS_FILTERS,
  type StatusFilter,
} from '@/domain/documents'
import { pdfFileName, printUrl, saveBlob } from '@/domain/download'
import { formatBytes } from '@/domain/format'
import { STEPS } from '@/stores/wizard'

const router = useRouter()
const status = ref<StatusFilter>('All')
const page = ref(1)
const query = ref('')

const { items, total, loading, error, offset, hasNext, reload } = useDocumentList(status, page)
const { templates } = useTemplates()

watch(status, () => (page.value = 1))

const labelOf = (id: string | null) =>
  templates.value.find((template) => template.id === id)?.shortLabel ?? id ?? 'Document'

const visible = computed(() =>
  items.value.filter((item) => matchesSearch(item, query.value, labelOf(item.templateId))),
)

const selectedId = ref<string | null>(null)
const selected = computed(
  () => visible.value.find((item) => item.id === selectedId.value) ?? visible.value[0] ?? null,
)

const actionError = ref<string | null>(null)
const voidTarget = ref<DocumentListItem | null>(null)

async function download(item: DocumentListItem) {
  actionError.value = null
  try {
    saveBlob(await documentsApi.content(item.id), pdfFileName(item.name))
  } catch (e) {
    actionError.value = errorMessage(e)
  }
}

async function print(item: DocumentListItem) {
  actionError.value = null
  try {
    const url = URL.createObjectURL(await documentsApi.content(item.id))
    printUrl(url)
    useTimeoutFn(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    actionError.value = errorMessage(e)
  }
}

const statusTone = (value: string) =>
  value === 'Voided' ? 'text-alert-400' : value === 'Delivered' ? 'text-success-400' : 'text-white'
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-dark-400 text-white">
    <header class="flex items-center justify-between px-6 py-4">
      <div class="flex items-center gap-2">
        <span
          class="flex size-6 items-center justify-center rounded-sm bg-white text-xs font-bold text-dark-400"
          aria-hidden="true"
        >
          M
        </span>
        <h1 class="text-base font-bold">MDoc</h1>
      </div>
      <UiButton @click="router.push(STEPS[0].path)">New document</UiButton>
    </header>

    <div class="flex min-h-0 flex-1 border-t border-dark-600">
      <section class="flex min-w-0 flex-1 flex-col gap-4 px-6 py-6" aria-label="Documents">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-xl font-bold tracking-tight">Documents</h2>
          <input
            v-model="query"
            type="search"
            placeholder="Search this page"
            aria-label="Search documents on this page"
            class="h-9 w-64 rounded-md border border-dark-600 bg-dark-500 px-3 text-sm text-white outline-none placeholder:text-light-400 focus:border-accent-400"
          />
        </div>

        <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <UiFilterChip
            v-for="filter in STATUS_FILTERS"
            :key="filter"
            :label="filter"
            :selected="status === filter"
            @click="status = filter"
          />
        </div>

        <p
          v-if="error"
          class="flex items-center justify-between gap-3 rounded-md bg-alert-600 px-3 py-2 text-sm"
          role="alert"
        >
          Couldn't load documents: {{ error }}
          <button type="button" class="font-semi-bold underline" @click="reload">Retry</button>
        </p>
        <p v-else-if="loading" class="text-sm text-light-400" role="status">Loading documents…</p>
        <p v-else-if="visible.length === 0" class="text-sm text-light-400">
          {{ query ? 'No documents on this page match.' : 'No documents yet.' }}
        </p>

        <ul v-else class="flex flex-col">
          <li v-for="item in visible" :key="item.id">
            <button
              type="button"
              class="grid w-full grid-cols-[1fr_6rem_7rem_5rem] items-center gap-4 border-b border-dark-600 px-2 py-3 text-left text-sm outline-none hover:bg-dark-500 focus-visible:shadow-focus-ring"
              :class="selected?.id === item.id ? 'bg-dark-500' : ''"
              @click="selectedId = item.id"
              @dblclick="router.push(`/documents/${item.id}`)"
            >
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-semi-bold">{{ item.name }}</span>
                <span class="truncate text-xs text-light-400">{{ labelOf(item.templateId) }}</span>
              </span>
              <span class="text-xs font-semi-bold" :class="statusTone(item.status)">{{
                item.status
              }}</span>
              <span class="text-xs text-light-400">{{
                formatDay(item.updatedAt ?? item.createdAt)
              }}</span>
              <span class="text-xs text-light-400">{{ formatBytes(item.sizeBytes ?? -1) }}</span>
            </button>
          </li>
        </ul>

        <div class="mt-auto flex items-center justify-between text-xs text-light-400">
          <span>{{ pageRange(offset, items.length, total) }}</span>
          <div class="flex gap-4">
            <button
              type="button"
              class="font-semi-bold enabled:hover:text-white disabled:opacity-40"
              :disabled="page <= 1"
              @click="page -= 1"
            >
              Previous
            </button>
            <button
              type="button"
              class="font-semi-bold enabled:hover:text-white disabled:opacity-40"
              :disabled="!hasNext"
              @click="page += 1"
            >
              Next
            </button>
          </div>
        </div>
        <span class="sr-only">{{ PAGE_SIZE }} documents per page</span>
      </section>

      <aside
        class="flex w-96 shrink-0 flex-col gap-4 border-l border-dark-600 p-6"
        aria-label="Selected document"
      >
        <template v-if="selected">
          <div
            class="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-dark-500"
          >
            <img
              :src="documentsApi.contentUrl(selected.id, { type: 'image' })"
              :alt="`Preview of ${selected.name}`"
              class="size-full object-contain"
            />
          </div>
          <div class="flex flex-col gap-1">
            <h3 class="text-lg font-bold">{{ selected.name }}</h3>
            <p class="text-xs text-light-400">
              PDF · {{ formatDay(selected.updatedAt ?? selected.createdAt) }} ·
              {{ formatBytes(selected.sizeBytes ?? -1) }}
            </p>
            <p class="text-xs text-light-400">{{ labelOf(selected.templateId) }}</p>
          </div>
          <p v-if="actionError" class="text-xs text-alert-400" role="alert">{{ actionError }}</p>
          <div class="flex flex-col gap-1 border-t border-dark-600 pt-4 text-sm">
            <button
              type="button"
              class="rounded-md px-2 py-2 text-left hover:bg-dark-500"
              @click="router.push(`/documents/${selected.id}`)"
            >
              Open document
            </button>
            <button
              type="button"
              class="rounded-md px-2 py-2 text-left hover:bg-dark-500"
              @click="download(selected)"
            >
              Download PDF
            </button>
            <button
              type="button"
              class="rounded-md px-2 py-2 text-left hover:bg-dark-500"
              @click="print(selected)"
            >
              Print PDF
            </button>
            <button
              type="button"
              class="rounded-md px-2 py-2 text-left hover:bg-dark-500 disabled:opacity-40"
              :disabled="selected.status === 'Voided'"
              @click="voidTarget = selected"
            >
              Void
            </button>
          </div>
        </template>
        <p v-else class="text-sm text-light-400">Select a document to see its details.</p>
      </aside>
    </div>

    <VoidDialog
      :open="voidTarget !== null"
      :document-id="voidTarget?.id ?? ''"
      :name="voidTarget?.name ?? ''"
      @close="voidTarget = null"
      @voided="reload"
    />
  </div>
</template>