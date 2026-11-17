<script setup lang="ts">
import { computed } from 'vue'

import { buildQr, QR_EYE_SHAPES, renderQrSvg, type QrEyeShape, type QrStyle } from '@/domain/qr'

import UiSegmentedControl from './UiSegmentedControl.vue'

const model = defineModel<QrStyle>({ required: true })

const props = defineProps<{
  accent: string
  logo?: string | null
  sample?: string
}>()

const COLOR_OPTIONS = [
  { value: 'brand' as const, label: 'Brand' },
  { value: 'monochrome' as const, label: 'Monochrome' },
]

const SHAPE_LABELS: Record<QrEyeShape, string> = {
  square: 'Square',
  rounded: 'Rounded',
  circle: 'Circle',
  leaf: 'Leaf',
}

const SHAPE_CLASSES: Record<QrEyeShape, { ring: string; ball: string }> = {
  square: { ring: 'rounded-none', ball: 'rounded-none' },
  rounded: { ring: 'rounded-lg', ball: 'rounded-[3px]' },
  circle: { ring: 'rounded-full', ball: 'rounded-full' },
  leaf: { ring: 'rounded-tl-[10px] rounded-br-[10px]', ball: 'rounded-tl-[5px] rounded-br-[5px]' },
}

function patch(change: Partial<QrStyle>) {
  model.value = { ...model.value, ...change }
}

const render = computed(() => {
  const palette = { primary: props.accent, accent: props.accent }
  return buildQr(props.sample ?? 'https://mdoc.example/verify/MHB-Q-26-009', model.value, palette)
})

const svg = computed(() => renderQrSvg(render.value, { quietZone: 2 }))

const logoStyle = computed(() => {
  const box = render.value.logoBox
  if (!box) return undefined
  const total = render.value.size + 4
  return {
    left: `${((box.x + 2) / total) * 100}%`,
    top: `${((box.y + 2) / total) * 100}%`,
    width: `${(box.size / total) * 100}%`,
    height: `${(box.size / total) * 100}%`,
  }
})
</script>

<template>
  <div class="flex gap-5 rounded-md border border-dark-600 bg-dark-500 p-4" data-testid="qr-fields">
    <div class="flex min-w-0 flex-1 flex-col gap-3.5">
      <UiSegmentedControl
        label="Colors"
        :model-value="model.color"
        :options="COLOR_OPTIONS"
        @update:model-value="patch({ color: $event })"
      />

      <div class="flex flex-col gap-1.5">
        <span id="qr-eye-shape" class="text-sm font-semi-bold text-light-600">Eye shape</span>
        <div role="radiogroup" aria-labelledby="qr-eye-shape" class="grid grid-cols-4 gap-2">
          <button
            v-for="shape in QR_EYE_SHAPES"
            :key="shape"
            type="button"
            role="radio"
            :aria-checked="model.eyeShape === shape"
            class="flex flex-col items-center gap-1 rounded-md border bg-dark-600/40 pt-2 pb-1.5 text-xs outline-none transition-colors focus-visible:shadow-focus-ring"
            :class="
              model.eyeShape === shape
                ? 'border-2 border-accent-500 text-white'
                : 'border-dark-600 text-light-400 hover:text-white'
            "
            @click="patch({ eyeShape: shape })"
          >
            <span
              class="flex size-7 items-center justify-center border-[3px] border-light-600"
              :class="SHAPE_CLASSES[shape].ring"
              aria-hidden="true"
            >
              <span class="size-2.5 bg-light-600" :class="SHAPE_CLASSES[shape].ball" />
            </span>
            {{ SHAPE_LABELS[shape] }}
          </button>
        </div>
      </div>

      <UiSegmentedControl
        label="Eye color"
        :model-value="model.eyeColor"
        :options="COLOR_OPTIONS"
        @update:model-value="patch({ eyeColor: $event })"
      />

      <label class="flex items-center gap-2.5 text-sm font-semi-bold text-light-600">
        Brand logo in center
        <input
          type="checkbox"
          role="switch"
          class="relative h-5 w-9 cursor-pointer appearance-none rounded-full bg-dark-600 transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform checked:bg-accent-500 checked:after:translate-x-4"
          :checked="model.logo"
          @change="patch({ logo: ($event.target as HTMLInputElement).checked })"
        />
      </label>

      <p class="text-xs text-light-400">
        Applied to Invoice, Receipt, Quotation and Agreements. Invoices and receipts link to UPI
        payment; agreements link to verification.
      </p>
    </div>

    <figure class="flex shrink-0 flex-col items-center gap-2">
      <div class="relative size-36 overflow-hidden rounded-md bg-white" data-testid="qr-preview">
        <!-- eslint-disable-next-line vue/no-v-html -- generated locally from numeric geometry only -->
        <div class="size-full [&>svg]:size-full" v-html="svg" />
        <div
          v-if="logoStyle && logo"
          class="absolute flex items-center justify-center bg-white p-[10%]"
          :style="logoStyle"
        >
          <img :src="logo" alt="" class="size-full object-contain" />
        </div>
      </div>
      <figcaption class="text-xs text-light-400">Live preview</figcaption>
    </figure>
  </div>
</template>