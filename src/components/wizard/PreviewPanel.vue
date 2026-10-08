<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'

import type { TemplatePage } from '@/api'
import UiDocToolbar from '@/components/ui/UiDocToolbar.vue'
import UiPageRail from '@/components/ui/UiPageRail.vue'
import { blobFromUrl, pdfFileName, saveBlob } from '@/domain/download'
import { mostVisiblePage } from '@/domain/pages'

import ImagePages from './ImagePages.vue'

const PdfDocument = defineAsyncComponent(() => import('./PdfDocument.vue'))

const props = defineProps<{
  label: string
  url: string | null
  pages?: TemplatePage[]
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
const hasImages = computed(() => (props.pages?.length ?? 0) > 0)
const active = computed(() => hasImages.value || props.url !== null)

interface Layer {
  id: number
  url: string | null
  pages: TemplatePage[] | null
  ready: boolean
}

const SETTLE_MS = 600

const layers = ref<Layer[]>([])
let nextLayerId = 0
let pruneTimer: ReturnType<typeof setTimeout> | undefined

const source = computed(() => {
  if (hasImages.value && props.pages) return `images:${props.pages.map((p) => p.url).join('|')}`
  return props.url ? `pdf:${props.url}` : null
})

watch(
  source,
  (key) => {
    clearTimeout(pruneTimer)
    if (key === null) {
      layers.value = []
      return
    }
    const shown = [...layers.value].reverse().find((layer) => layer.ready)
    const incoming: Layer = {
      id: nextLayerId++,
      url: hasImages.value ? null : props.url,
      pages: hasImages.value ? (props.pages ?? null) : null,
      ready: false,
    }
    layers.value = shown ? [shown, incoming] : [incoming]
  },
  { immediate: true },
)

const newestId = computed(() => layers.value[layers.value.length - 1]?.id ?? -1)
const newestReady = computed(() => layers.value[layers.value.length - 1]?.ready ?? false)

function layerClass(layer: Layer): string {
  if (layer.id === newestId.value) {
    return layer.ready ? 'opacity-100 blur-0' : 'opacity-0 blur-md'
  }
  return newestReady.value ? 'opacity-0 blur-lg' : 'opacity-100 blur-[3px]'
}

function markReady(id: number) {
  const layer = layers.value.find((item) => item.id === id)
  if (!layer || layer.ready) return
  layer.ready = true
  if (id !== newestId.value) return
  clearTimeout(pruneTimer)
  pruneTimer = setTimeout(() => {
    layers.value = layers.value.filter((item) => item.id >= id)
  }, SETTLE_MS)
}

function onLayerPages(id: number, count: number) {
  if (id === newestId.value) onPages(count)
}

function onLayerAspect(id: number, ratio: number) {
  if (id === newestId.value) aspect.value = ratio
}

function onPdfAspect(id: number, ratio: number) {
  onLayerAspect(id, ratio)
  markReady(id)
}

function onPages(count: number) {
  pageCount.value = count
  if (page.value > count) page.value = count
}

onBeforeUnmount(() => clearTimeout(pruneTimer))

let jumping = false
let jumpTimer: ReturnType<typeof setTimeout> | undefined
let frame = 0

function pageBoxes() {
  const container = stage.value
  if (!container) return []
  const origin = container.getBoundingClientRect().top
  return [...container.querySelectorAll<HTMLElement>('[data-newest] [data-page]')].map((el) => {
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
      <span
        v-if="(loading && url) || (layers.length > 0 && !newestReady && !renderError)"
        class="flex items-center gap-2 text-xs text-light-400"
        role="status"
      >
        <span
          class="size-3 animate-spin rounded-full border-2 border-light-500 border-t-transparent"
          aria-hidden="true"
        />
        Updating…
      </span>
    </header>

    <div class="relative flex min-h-0 flex-1 items-center justify-center">
      <p
        v-if="!active && !error && !loading"
        class="max-w-64 text-center text-sm text-light-400"
        data-testid="preview-empty"
      >
        Nothing to preview yet. Pick a template on the left to see it here.
      </p>
      <p v-else-if="!active && loading" class="text-sm text-light-400" role="status">
        Rendering preview…
      </p>

      <div
        v-if="active"
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
        <div class="grid min-h-full min-w-full place-items-center p-3">
          <div
            v-for="layer in layers"
            :key="layer.id"
            class="col-start-1 row-start-1 transition-[opacity,filter] duration-500 ease-out"
            :class="[layerClass(layer), layer.id === newestId ? '' : 'pointer-events-none']"
            :data-newest="layer.id === newestId ? '' : undefined"
            :aria-hidden="layer.id === newestId ? undefined : true"
          >
            <ImagePages
              v-if="layer.pages"
              :pages="layer.pages"
              :width="pageWidth"
              @pages="onLayerPages(layer.id, $event)"
              @aspect="onLayerAspect(layer.id, $event)"
              @ready="markReady(layer.id)"
            />
            <PdfDocument
              v-else-if="layer.url"
              :url="layer.url"
              :width="pageWidth"
              @pages="onLayerPages(layer.id, $event)"
              @aspect="onPdfAspect(layer.id, $event)"
              @failed="renderError = $event"
            />
          </div>
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
        v-if="active && pageCount > 1"
        :model-value="page"
        :pages="pageCount"
        class="absolute top-1/2 right-4 -translate-y-1/2"
        @update:model-value="goToPage"
      />

      <UiDocToolbar
        v-if="active"
        v-model:zoom="zoom"
        :download-disabled="downloading || !url"
        class="absolute bottom-2 left-1/2 -translate-x-1/2"
        @fit="userZoom = null"
        @print="print"
        @download="download"
      />
    </div>
  </section>
</template>