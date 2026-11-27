<script setup lang="ts">
import IconPlus from '~icons/lucide/plus'
import { useTimeoutFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { documentsApi, type DocumentListItem } from '@/api'
import DocumentCard from '@/components/documents/DocumentCard.vue'
import VoidDialog from '@/components/documents/VoidDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useDocumentList } from '@/composables/useDocuments'
import { errorMessage, useTemplates } from '@/composables/useTemplates'
import {
  groupByColumn,
  matchesSearch,
  pageRange,
  type BoardColumn,
  type StatusFilter,
} from '@/domain/documents'
import { pdfFileName, printUrl, saveBlob } from '@/domain/download'
import { STEPS } from '@/stores/wizard'

const router = useRouter()
const status = ref<StatusFilter>('All')
const page = ref(1)
const query = ref('')

const { items, total, loading, error, offset, hasNext, reload } = useDocumentList(status, page)
const { templates } = useTemplates()

watch(status, () => (page.value = 1))

const RETRY_AFTER = 10_000
const retry = useTimeoutFn(reload, RETRY_AFTER, { immediate: false })
watch([error, loading], ([failed, busy]) => {
  if (failed && !busy) retry.start()
  else retry.stop()
})

const labelOf = (id: string | null) =>
  templates.value.find((template) => template.id === id)?.shortLabel ?? id ?? 'Document'

const visible = computed(() =>
  items.value.filter((item) => matchesSearch(item, query.value, labelOf(item.templateId))),
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

/** With no scrollbar, a plain mouse wheel must still reach the columns off to the side. */
function scrollSideways(event: WheelEvent) {
  const board = event.currentTarget as HTMLElement
  const vertical = Math.abs(event.deltaY) > Math.abs(event.deltaX)
  // A board taller than the screen keeps the wheel for up and down; Shift still moves it sideways.
  if (!vertical || event.shiftKey || board.scrollHeight > board.clientHeight) return
  event.preventDefault()
  board.scrollLeft += event.deltaY
}

const columns = computed(() => groupByColumn(visible.value))
const numbers = computed(
  () => new Map(items.value.map((item, i) => [item.id, offset.value + i + 1] as const)),
)

const DOTS: Record<string, string> = {
  Draft: 'bg-info-500',
  Ready: 'bg-success-500',
  Sent: 'bg-info-500',
  'Partially Signed': 'bg-info-500',
  Signed: 'bg-success-500',
  Void: 'bg-alert-500',
}
const dot = (column: BoardColumn) => DOTS[column] ?? 'bg-light-400'
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-dark-400 text-white">
    <p
      v-if="error"
      class="flex items-center justify-between gap-4 bg-alert-soft px-6 py-3 text-sm font-semi-bold text-dark-400"
      role="alert"
      :title="error"
    >
      Service unavailable — documents can’t be loaded right now. We’ll keep retrying.
      <button type="button" class="text-alert-600" @click="reload">Retry now</button>
    </p>
    <header class="flex items-center justify-between px-8 py-4">
      <div class="flex items-center gap-2">
        <span
          class="flex size-6 items-center justify-center rounded-sm bg-white text-xs font-bold text-dark-400"
          aria-hidden="true"
        >
          M
        </span>
        <h1 class="text-base font-bold">MDoc</h1>
      </div>
      <div class="flex items-center gap-2">
        <UiButton variant="ghost" @click="router.push('/terms')">Terms</UiButton>
        <UiButton @click="router.push(STEPS[0].path)">New document</UiButton>
      </div>
    </header>

    <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-8" aria-label="Documents">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-xl font-semi-bold">Documents</h2>
        <input
          v-model="query"
          type="search"
          placeholder="Search documents"
          aria-label="Search documents on this page"
          class="h-9 w-64 rounded-md border border-dark-600 bg-dark-400 px-3 text-sm text-white outline-none placeholder:text-light-400 focus:border-accent-400"
        />
      </div>

      <p v-if="loading" class="text-sm text-light-400" role="status">Loading documents…</p>
      <p v-else-if="visible.length === 0" class="text-sm text-light-400">
        {{ query ? 'No documents on this page match.' : 'No documents yet.' }}
      </p>
      <p v-if="actionError" class="text-xs text-alert-400" role="alert">{{ actionError }}</p>

      <div
        v-if="!error && !loading"
        class="no-scrollbar flex min-h-0 flex-1 gap-3 overflow-auto"
        @wheel="scrollSideways"
      >
        <div
          v-for="group in columns"
          :key="group.column"
          class="flex w-64 shrink-0 flex-col gap-3"
          :aria-label="group.column"
        >
          <div
            class="flex h-10 shrink-0 items-center gap-2 rounded-full bg-overlay px-2.5 text-sm font-semi-bold"
          >
            <span class="size-2 rounded-full" :class="dot(group.column)" aria-hidden="true" />
            <span class="flex-1">{{ group.column }}</span>
            <span class="text-xs text-light-500">{{ group.items.length }}</span>
            <button
              v-if="group.column === 'Draft'"
              type="button"
              class="flex size-5 items-center justify-center rounded-sm text-light-600 outline-none hover:bg-dark-600 hover:text-white focus-visible:shadow-focus-ring"
              aria-label="New document"
              @click="router.push(STEPS[0].path)"
            >
              <IconPlus class="size-4" aria-hidden="true" />
            </button>
          </div>
          <DocumentCard
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            :index="numbers.get(item.id) ?? 0"
            :label="labelOf(item.templateId)"
            @download="download"
            @print="print"
            @void="voidTarget = $event"
          />
        </div>
      </div>

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
    </section>

    <VoidDialog
      :open="voidTarget !== null"
      :document-id="voidTarget?.id ?? ''"
      @close="voidTarget = null"
      @voided="reload"
    />
  </div>
</template>