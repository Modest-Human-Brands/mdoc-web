<script setup lang="ts">
import { usePDF, VuePDF } from '@tato30/vue-pdf'
import { computed, reactive, toRef, watchEffect } from 'vue'

import type { SignerField } from '@/api'
import { DEFAULT_PAGE_SIZE, marksFor, type FieldMark } from '@/domain/signing'

const props = defineProps<{
  url: string
  width: number
  fields?: SignerField[]
}>()

const emit = defineEmits<{
  pages: [count: number]
  aspect: [ratio: number]
  failed: [message: string]
  mark: [mark: FieldMark]
}>()

const { pdf, pages } = usePDF(toRef(props, 'url'), {
  onError: (error: unknown) =>
    emit('failed', error instanceof Error ? error.message : 'Cannot read PDF'),
})

watchEffect(() => {
  if (pages.value > 0) emit('pages', pages.value)
})

const sizes = reactive<Record<number, { width: number; height: number }>>({})

function onLoaded(n: number, viewport: { width: number; height: number; viewBox?: number[] }) {
  if (viewport.width <= 0) return
  const box = viewport.viewBox
  const width = box ? box[2]! - box[0]! : DEFAULT_PAGE_SIZE.width
  sizes[n] = { width, height: box ? box[3]! - box[1]! : (width * viewport.height) / viewport.width }
  if (n === 1) emit('aspect', viewport.height / viewport.width)
}

const marks = computed(() => marksFor(props.fields ?? [], pages.value))

function marksOn(page: number): FieldMark[] {
  return marks.value.filter((mark) => mark.page === page)
}

function boxStyle(mark: FieldMark, page: number) {
  const size = sizes[page] ?? DEFAULT_PAGE_SIZE
  return {
    left: `${(mark.x / size.width) * 100}%`,
    top: `${((size.height - mark.y - mark.height) / size.height) * 100}%`,
    width: `${(mark.width / size.width) * 100}%`,
    height: `${(mark.height / size.height) * 100}%`,
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div
      v-for="n in pages"
      :key="n"
      :data-page="n"
      class="relative shrink-0 overflow-hidden rounded-sm bg-white shadow-doc-page"
    >
      <VuePDF
        :pdf="pdf"
        :page="n"
        :width="width"
        class="block max-w-none bg-white"
        @loaded="onLoaded(n, $event)"
      />
      <button
        v-for="mark in marksOn(n)"
        :key="mark.key"
        type="button"
        data-mark
        :aria-label="mark.label"
        :style="boxStyle(mark, n)"
        class="absolute flex animate-pulse items-center justify-center rounded-sm border-2 border-dashed border-accent-400 bg-accent-400/20 text-[10px] leading-none font-bold text-accent-500 transition-colors hover:animate-none hover:bg-accent-400/35 focus-visible:shadow-focus-ring focus-visible:outline-none"
        @click="emit('mark', mark)"
      >
        {{ mark.label }}
      </button>
    </div>
  </div>
</template>