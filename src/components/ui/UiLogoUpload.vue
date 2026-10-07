<script setup lang="ts">
import { ImagePlus } from 'lucide-vue-next'
import { ref } from 'vue'

export interface LogoValue {
  name: string
  dataUrl: string
}

const model = defineModel<LogoValue | null>({ required: true })

const MAX_BYTES = 1024 * 1024
const input = ref<HTMLInputElement | null>(null)
const error = ref<string | null>(null)

function onPick(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  if (!/^image\/(svg\+xml|png)$/.test(file.type)) {
    error.value = 'Use an SVG or PNG file.'
    return
  }
  if (file.size > MAX_BYTES) {
    error.value = 'The file is larger than 1 MB.'
    return
  }
  error.value = null
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') model.value = { name: file.name, dataUrl: reader.result }
  }
  reader.onerror = () => (error.value = 'Could not read that file.')
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div
      class="flex h-16 items-center gap-3 rounded-md border border-dark-600 p-3"
      :class="model ? '' : 'border-dashed'"
    >
      <span
        class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white"
      >
        <img v-if="model" :src="model.dataUrl" alt="" class="size-full object-contain" />
        <ImagePlus v-else :size="18" :stroke-width="1.5" class="text-dark-600" aria-hidden="true" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-sm font-semi-bold text-white">
          {{ model ? model.name : 'No logo yet' }}
        </span>
        <span class="text-xs text-light-400">SVG or PNG, square works best</span>
      </span>
      <button
        type="button"
        class="rounded-md border border-dark-600 px-3 py-1.5 text-xs font-semi-bold text-light-600 outline-none hover:bg-dark-600 focus-visible:shadow-focus-ring"
        @click="input?.click()"
      >
        {{ model ? 'Replace' : 'Upload' }}
      </button>
      <input
        ref="input"
        type="file"
        accept="image/svg+xml,image/png"
        class="sr-only"
        tabindex="-1"
        aria-label="Upload logo"
        @change="onPick"
      />
    </div>
    <p v-if="error" class="text-xs text-alert-400" role="alert">{{ error }}</p>
  </div>
</template>