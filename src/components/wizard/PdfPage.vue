<script setup lang="ts">
import { usePDF, VuePDF } from '@tato30/vue-pdf'
import { toRef, watch } from 'vue'

const props = defineProps<{
  url: string
  page: number
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

watch(pages, (count) => count > 0 && emit('pages', count), { immediate: true })

function onLoaded(viewport: { width: number; height: number }) {
  if (viewport.width > 0) emit('aspect', viewport.height / viewport.width)
}
</script>

<template>
  <VuePDF
    :pdf="pdf"
    :page="Math.min(Math.max(1, page), Math.max(1, pages))"
    :width="width"
    class="block max-w-none bg-white"
    @loaded="onLoaded"
  />
</template>