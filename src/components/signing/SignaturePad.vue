<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import UiSegmentedControl from '@/components/ui/UiSegmentedControl.vue'
import { rasterizeLogo } from '@/domain/image'

const SIGNATURE_MAX_SIDE = 600

const model = defineModel<string | null>({ default: null })

const mode = ref<'draw' | 'upload'>('draw')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const failure = ref<string | null>(null)
let drawing = false

function context() {
  return canvas.value?.getContext('2d') ?? null
}

function point(event: PointerEvent) {
  const element = canvas.value
  if (!element) return { x: 0, y: 0 }
  const rect = element.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) * element.width) / rect.width,
    y: ((event.clientY - rect.top) * element.height) / rect.height,
  }
}

function start(event: PointerEvent) {
  const ctx = context()
  if (!ctx || !canvas.value) return
  canvas.value.setPointerCapture(event.pointerId)
  drawing = true
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#111827'
  const { x, y } = point(event)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + 0.01, y + 0.01)
  ctx.stroke()
}

function move(event: PointerEvent) {
  const ctx = context()
  if (!drawing || !ctx) return
  const { x, y } = point(event)
  ctx.lineTo(x, y)
  ctx.stroke()
}

function end() {
  if (!drawing || !canvas.value) return
  drawing = false
  model.value = canvas.value.toDataURL('image/png')
}

function clear() {
  const ctx = context()
  if (ctx && canvas.value) ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  model.value = null
  failure.value = null
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  failure.value = null
  try {
    model.value = await rasterizeLogo(file, SIGNATURE_MAX_SIDE)
  } catch {
    failure.value = 'That image could not be read. Use a PNG, JPG or SVG.'
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <UiSegmentedControl
      v-model="mode"
      label="Signature style"
      :options="[
        { value: 'draw', label: 'Draw' },
        { value: 'upload', label: 'Upload' },
      ]"
      @update:model-value="clear"
    />

    <div v-if="mode === 'draw'" class="flex flex-col gap-2">
      <div class="relative h-35 overflow-hidden rounded-lg bg-white">
        <canvas
          ref="canvas"
          width="1008"
          height="280"
          class="size-full touch-none cursor-crosshair"
          aria-label="Draw your signature here"
          @pointerdown="start"
          @pointermove="move"
          @pointerup="end"
          @pointercancel="end"
        />
        <span
          v-if="!model"
          class="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-semi-bold text-light-500"
        >
          Draw your signature here
        </span>
      </div>
      <button
        type="button"
        class="self-end text-xs font-semi-bold text-light-400 hover:text-white"
        @click="clear"
      >
        Clear
      </button>
    </div>

    <div v-else class="flex flex-col gap-2">
      <label
        class="flex h-35 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-dark-600 bg-white text-sm text-light-500"
      >
        <img
          v-if="model"
          :src="model"
          alt="Your uploaded signature"
          class="size-full object-contain"
        />
        <span v-else>Choose an image of your signature</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          class="sr-only"
          @change="onFile"
        />
      </label>
      <p v-if="failure" class="text-xs text-alert-400" role="alert">{{ failure }}</p>
    </div>
  </div>
</template>