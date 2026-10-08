<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, defineAsyncComponent, ref, watch } from 'vue'

import UiDocToolbar from '@/components/ui/UiDocToolbar.vue'
import UiPageRail from '@/components/ui/UiPageRail.vue'
import { blobFromUrl, pdfFileName, saveBlob } from '@/domain/download'
import { mostVisiblePage } from '@/domain/pages'

const PdfDocument = defineAsyncComponent(() => import('./PdfDocument.vue'))

const props = defineProps<{
  label: string
  url: string | null
  loading?: boolean
  error?: string | null
  fetchDownload?: () => Promise<Blob>
  downloadName?: string
  resetKey?: string | null
}>()

const PAGE_WIDTH = 520
const MIN_ZOOM = 50
const MAX_ZOOM = 200
const STAGE_PADDING = 24

const userZoom = ref<number | null>(null)
const page = ref(1)
const pageCount = ref(1)
const aspect = ref(Math.SQRT2)
const renderError = ref<string | null>(null)
const downloading = ref(false)
const downloadError = ref<string | null>(null)

const stage = ref<HTMLElement | null>(null)
const { width: stageWidth, height: stageHeight } = useElementSize(stage)

watch(
  () => props.resetKey,
  () => {
    page.value = 1
    stage.value?.scrollTo({ top: 0 })
  },
)
watch(
  () => props.url,
  () => (renderError.value = null),
)

const fitZoom = computed(() => {
  if (stageWidth.value <= 0 || stageHeight.value <= 0) return 100
  const byHeight = (stageHeight.value - STAGE_PADDING) / (PAGE_WIDTH * aspect.value)
  const byWidth = (stageWidth.value - STAGE_PADDING) / PAGE_WIDTH
  const fit = Math.floor(Math.min(byHeight, byWidth) * 100)
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fit))
})

const zoom = computed({
  get: () => userZoom.value ?? Math.min(100, fitZoom.value),
  set: (value: number) => (userZoom.value = value),
})

const pageWidth = computed(() => (PAGE_WIDTH * zoom.value) / 100)

function onPages(count: number) {
  pageCount.value = count
  if (page.value > count) page.value = count
}

let jumping = false
let jumpTimer: ReturnType<typeof setTimeout> | undefined
let frame = 0

function pageBoxes() {
  const container = stage.value
  if (!container) return []
  const origin = container.getBoundingClientRect().top
  return [...container.querySelectorAll<HTMLElement>('[data-page]')].map((el) => {
    const rect = el.getBoundingClientRect()
    return { top: rect.top - origin, bottom: rect.bottom - origin }
  })
}

function onScroll() {
  if (jumping || frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    const container = stage.value
    if (!container) return
    page.value = mostVisiblePage(pageBoxes(), 0, container.clientHeight)
  })
}

function endJump() {
  jumping = false
  clearTimeout(jumpTimer)
}

function goToPage(target: number) {
  const container = stage.value
  const el = container?.querySelector<HTMLElement>(`[data-page="${target}"]`)
  page.value = target
  if (!container || !el) return
  jumping = true
  clearTimeout(jumpTimer)
  jumpTimer = setTimeout(endJump, 900)
  const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top
  container.scrollTo({ top: container.scrollTop + offset - STAGE_PADDING / 2, behavior: 'smooth' })
}

function print() {
  if (!props.url) return
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  frame.src = props.url
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 60_000)
  }
  document.body.append(frame)
}

async function download() {
  if (!props.url || downloading.value) return
  downloading.value = true
  downloadError.value = null
  try {
    const blob = props.fetchDownload ? await props.fetchDownload() : await blobFromUrl(props.url)
    saveBlob(blob, pdfFileName(props.downloadName ?? props.label))
  } catch (e) {
    downloadError.value = e instanceof Error ? e.message : 'Download failed.'
  } finally {
    downloading.value = false
  }
}

let drag: { x: number; y: number; left: number; top: number } | null = null

function onPointerDown(event: PointerEvent) {
  if (!stage.value || event.button !== 0) return
  drag = {
    x: event.clientX,
    y: event.clientY,
    left: stage.value.scrollLeft,
    top: stage.value.scrollTop,
  }
  stage.value.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!drag || !stage.value) return
  stage.value.scrollLeft = drag.left - (event.clientX - drag.x)
  stage.value.scrollTop = drag.top - (event.clientY - drag.y)
}

function onPointerUp(event: PointerEvent) {
  drag = null
  stage.value?.releasePointerCapture(event.pointerId)
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

      <div
        v-if="url"
        ref="stage"
        class="no-scrollbar size-full touch-none overflow-auto"
        :class="zoom > fitZoom ? 'cursor-grab active:cursor-grabbing' : ''"
        data-testid="preview-stage"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @scroll.passive="onScroll"
        @scrollend="endJump"
      >
        <div class="flex min-h-full min-w-full flex-col items-center justify-center p-3">
          <PdfDocument
            :url="url"
            :width="pageWidth"
            class="transition-opacity"
            :class="loading ? 'opacity-70' : ''"
            @pages="onPages"
            @aspect="aspect = $event"
            @failed="renderError = $event"
          />
        </div>
      </div>

      <p
        v-if="error || renderError || downloadError"
        class="absolute top-0 right-0 left-0 rounded-md bg-alert-600 px-3 py-2 text-xs font-semi-bold text-white"
        role="alert"
      >
        {{
          downloadError
            ? `Download failed: ${downloadError}`
            : `Preview failed: ${error ?? renderError}`
        }}
      </p>

      <UiPageRail
        v-if="url && pageCount > 1"
        :model-value="page"
        :pages="pageCount"
        class="absolute top-1/2 right-4 -translate-y-1/2"
        @update:model-value="goToPage"
      />

      <UiDocToolbar
        v-if="url"
        v-model:zoom="zoom"
        :download-disabled="downloading"
        class="absolute bottom-2 left-1/2 -translate-x-1/2"
        @fit="userZoom = null"
        @print="print"
        @download="download"
      />
    </div>
  </section>
</template>