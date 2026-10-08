<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { defineAsyncComponent, ref } from 'vue'
import IconFileText from '~icons/lucide/file-text'

const PdfPage = defineAsyncComponent(() => import('./PdfPage.vue'))

defineProps<{
  url: string
}>()

const PAGE_WIDTH = 120

const root = ref<HTMLElement | null>(null)
const visible = ref(false)
const ready = ref(false)
const failed = ref(false)

const { stop } = useIntersectionObserver(root, ([entry]) => {
  if (entry?.isIntersecting) {
    visible.value = true
    stop()
  }
})
</script>

<template>
  <span ref="root" class="relative flex size-full items-start justify-center overflow-hidden">
    <IconFileText
      v-if="!ready || failed"
      class="m-auto size-16 text-light-500 [--icon-stroke:1]"
      aria-hidden="true"
    />
    <span
      v-if="visible && !failed"
      class="absolute top-3 overflow-hidden rounded-sm shadow-doc-page transition-opacity"
      :class="ready ? 'opacity-100' : 'opacity-0'"
    >
      <PdfPage
        :url="url"
        :page="1"
        :width="PAGE_WIDTH"
        @aspect="ready = true"
        @failed="failed = true"
      />
    </span>
  </span>
</template>