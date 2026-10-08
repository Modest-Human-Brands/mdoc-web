<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { defineAsyncComponent, ref } from 'vue'
import IconFileText from '~icons/lucide/file-text'

import { resolveApiUrl } from '@/api'

const PdfPage = defineAsyncComponent(() => import('./PdfPage.vue'))

const props = defineProps<{
  imageUrl?: string | null
  url: string
}>()

const PAGE_WIDTH = 120

const root = ref<HTMLElement | null>(null)
const visible = ref(false)
const ready = ref(false)
const failed = ref(false)
const imageFailed = ref(false)

const { stop } = useIntersectionObserver(root, ([entry]) => {
  if (entry?.isIntersecting) {
    visible.value = true
    stop()
  }
})

const useImage = () => Boolean(props.imageUrl) && !imageFailed.value
</script>

<template>
  <span ref="root" class="relative flex size-full items-start justify-center overflow-hidden">
    <span
      v-if="useImage() && imageUrl"
      class="absolute top-3 overflow-hidden rounded-sm shadow-doc-page"
    >
      <img
        :src="resolveApiUrl(imageUrl)"
        alt=""
        :width="PAGE_WIDTH"
        loading="lazy"
        decoding="async"
        class="block h-auto bg-white"
        :style="{ width: `${PAGE_WIDTH}px` }"
        @error="imageFailed = true"
      />
    </span>
    <template v-else>
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
          :url="resolveApiUrl(url)"
          :page="1"
          :width="PAGE_WIDTH"
          @aspect="ready = true"
          @failed="failed = true"
        />
      </span>
    </template>
  </span>
</template>