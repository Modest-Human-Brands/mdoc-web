<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import UiDocToolbar from '@/components/ui/UiDocToolbar.vue'
import UiPageRail from '@/components/ui/UiPageRail.vue'

const props = defineProps<{
  label: string
  /** Blob/object URL of the rendered PDF; null shows the empty state. */
  url: string | null
  pages?: number
  loading?: boolean
  error?: string | null
  /** Download target (e.g. the saved document); disables the download button when absent. */
  downloadUrl?: string | null
  downloadName?: string
}>()

const PAGE_WIDTH = 520
const PAGE_HEIGHT = 735 // A4 ratio

const zoom = ref(100)
const page = ref(1)
const frame = ref<HTMLIFrameElement | null>(null)

watch(
  () => props.url,
  () => (page.value = 1),
)

const pageStyle = computed(() => ({
  width: `${(PAGE_WIDTH * zoom.value) / 100}px`,
  height: `${(PAGE_HEIGHT * zoom.value) / 100}px`,
}))

const src = computed(() =>
  props.url ? `${props.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=${page.value}` : null,
)

function print() {
  try {
    frame.value?.contentWindow?.focus()
    frame.value?.contentWindow?.print()
  } catch {
    // Some browsers block printing a PDF embedded in a frame.
  }
}

function download() {
  if (!props.downloadUrl) return
  const link = document.createElement('a')
  link.href = props.downloadUrl
  link.download = props.downloadName ?? ''
  link.click()
}
</script>

<template>
  <section
    class="flex min-w-0 flex-1 flex-col gap-6 overflow-hidden rounded-xl border border-dark-600 bg-dark-500 px-8 py-6"
    aria-label="Document preview"
  >
    <header class="flex h-4.25 items-center justify-between">
      <h2 class="text-sm font-bold text-light-400">{{ label }}</h2>
      <span v-if="loading && url" class="text-xs text-light-400" role="status">Updating…</span>
    </header>

    <div class="relative flex min-h-0 flex-1 items-center justify-center">
      <p
        v-if="!url && !error && !loading"
        class="max-w-64 text-center text-sm text-light-400"
        data-testid="preview-empty"
      >
        Nothing to preview yet. Pick a template on the left to see it here.
      </p>
      <p v-else-if="!url && loading" class="text-sm text-light-400" role="status">
        Rendering preview…
      </p>

      <div v-if="url" class="size-full overflow-auto">
        <div class="flex min-h-full min-w-full items-center justify-center py-2">
          <div
            class="shrink-0 overflow-hidden rounded-sm bg-white shadow-doc-page transition-opacity"
            :class="loading ? 'opacity-70' : ''"
            :style="pageStyle"
          >
            <iframe
              :key="url"
              ref="frame"
              :src="src ?? undefined"
              title="Document preview"
              class="size-full border-0"
            />
          </div>
        </div>
      </div>

      <p
        v-if="error"
        class="absolute top-0 right-0 left-0 rounded-md bg-alert-600 px-3 py-2 text-xs font-semi-bold text-white"
        role="alert"
      >
        Preview failed: {{ error }}
      </p>

      <UiPageRail
        v-if="url && (pages ?? 1) > 1"
        v-model="page"
        :pages="pages ?? 1"
        class="absolute top-1/2 right-4 -translate-y-1/2"
      />

      <UiDocToolbar
        v-if="url"
        v-model:zoom="zoom"
        :download-disabled="!downloadUrl"
        class="absolute bottom-2 left-1/2 -translate-x-1/2"
        @fit="zoom = 100"
        @print="print"
        @download="download"
      />
    </div>
  </section>
</template>