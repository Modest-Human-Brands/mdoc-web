<script setup lang="ts">
import { usePDF, VuePDF } from '@tato30/vue-pdf'
import { toRef, watchEffect } from 'vue'

const props = defineProps<{
  url: string
  width: number
}>()

const emit = defineEmits<{
  pages: [count: number]
  aspect: [ratio: number]
  failed: [message: string]
}>()

const { pdf, pages } = usePDF(toRef(props, 'url'), {
  onError: (error: unknown) =>
    emit('failed', error instanceof Error ? error.message : 'Cannot read PDF'),
})

watchEffect(() => {
  if (pages.value > 0) emit('pages', pages.value)
})

function onLoaded(viewport: { width: number; height: number }) {
  if (viewport.width > 0) emit('aspect', viewport.height / viewport.width)
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div
      v-for="n in pages"
      :key="n"
      :data-page="n"
      class="shrink-0 overflow-hidden rounded-sm bg-white shadow-doc-page"
    >
      <VuePDF
        :pdf="pdf"
        :page="n"
        :width="width"
        class="block max-w-none bg-white"
        @loaded="n === 1 && onLoaded($event)"
      />
    </div>
  </div>
</template>