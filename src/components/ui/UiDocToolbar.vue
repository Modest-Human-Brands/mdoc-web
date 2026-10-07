<script setup lang="ts">
import { Download, MessageSquare, Printer, Scan, ZoomIn, ZoomOut } from 'lucide-vue-next'

/** Zoom level in percent. */
const zoom = defineModel<number>('zoom', { default: 100 })

defineProps<{ downloadDisabled?: boolean }>()

const emit = defineEmits<{
  fit: []
  comment: []
  print: []
  download: []
}>()

const MIN_ZOOM = 50
const MAX_ZOOM = 200
const STEP = 10

const buttonClass =
  'flex size-8 items-center justify-center rounded-full text-light-500 outline-none transition-colors hover:text-white focus-visible:shadow-focus-ring'

function zoomBy(delta: number) {
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value + delta))
}
</script>

<template>
  <div
    class="flex items-center gap-1 rounded-full border border-dark-600 bg-dark-400 py-1.5 pr-1.5 pl-2 shadow-toolbar"
    role="toolbar"
    aria-label="Document tools"
  >
    <button
      type="button"
      :class="buttonClass"
      aria-label="Zoom out"
      :disabled="zoom <= MIN_ZOOM"
      @click="zoomBy(-STEP)"
    >
      <ZoomOut :size="18" :stroke-width="1.5" />
    </button>
    <span class="w-11 text-center text-xs font-semi-bold text-white" aria-live="polite">
      {{ zoom }}%
    </span>
    <button
      type="button"
      :class="buttonClass"
      aria-label="Zoom in"
      :disabled="zoom >= MAX_ZOOM"
      @click="zoomBy(STEP)"
    >
      <ZoomIn :size="18" :stroke-width="1.5" />
    </button>
    <button type="button" :class="buttonClass" aria-label="Fit page" @click="emit('fit')">
      <Scan :size="18" :stroke-width="1.5" />
    </button>
    <span class="h-5 w-px bg-dark-600" aria-hidden="true" />
    <button type="button" :class="buttonClass" aria-label="Comment" @click="emit('comment')">
      <MessageSquare :size="18" :stroke-width="1.5" />
    </button>
    <button type="button" :class="buttonClass" aria-label="Print" @click="emit('print')">
      <Printer :size="18" :stroke-width="1.5" />
    </button>
    <button
      type="button"
      class="flex size-9 items-center justify-center rounded-full bg-accent-500 text-white outline-none transition-colors hover:bg-accent-400 focus-visible:shadow-focus-ring disabled:bg-dark-600 disabled:text-light-400"
      aria-label="Download"
      :disabled="downloadDisabled"
      @click="emit('download')"
    >
      <Download :size="18" :stroke-width="1.5" />
    </button>
  </div>
</template>