<script setup lang="ts">
import { watch } from 'vue'

import type { TemplatePage } from '@/api'
import { resolveApiUrl } from '@/api'

const props = defineProps<{
  pages: TemplatePage[]
  width: number
}>()

const emit = defineEmits<{
  pages: [count: number]
  aspect: [ratio: number]
  ready: []
}>()

let announced = false

function announceReady() {
  if (announced) return
  announced = true
  emit('ready')
}

watch(
  () => props.pages,
  (list) => {
    emit('pages', list.length)
    const first = list[0]
    if (first && first.width > 0) emit('aspect', first.height / first.width)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div
      v-for="(item, index) in pages"
      :key="item.url"
      :data-page="index + 1"
      class="shrink-0 overflow-hidden rounded-sm bg-white shadow-doc-page"
    >
      <img
        :src="resolveApiUrl(item.url)"
        :alt="`Page ${index + 1}`"
        :width="width"
        :height="(width * item.height) / item.width"
        :style="{ width: `${width}px` }"
        class="block max-w-none bg-white"
        :loading="index === 0 ? 'eager' : 'lazy'"
        decoding="async"
        @load="index === 0 && announceReady()"
        @error="index === 0 && announceReady()"
        draggable="false"
      />
    </div>
  </div>
</template>