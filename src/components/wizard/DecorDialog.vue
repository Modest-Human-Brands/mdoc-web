<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { decorApi, resolveApiUrl, type DecorSummary } from '@/api'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import { errorMessage } from '@/composables/useTemplates'
import { recentDecor, rememberDecor } from '@/composables/useRecentDecor'
import { decorKind } from '@/domain/decor'
import { isHttpsUrl } from '@/domain/url'

const MAX_BYTES = 2 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const RULE = 'Use PNG, JPG, WebP or SVG up to 2 MB'

const props = defineProps<{
  open: boolean
  title: string
  value: string
  builtins: DecorSummary[]
  builtinProblem?: string | null
}>()

const emit = defineEmits<{ close: []; use: [value: string] }>()

const chosen = ref('none')
const urlDraft = ref('')
const urlProblem = ref<string | null>(null)
const uploading = ref(false)
const failure = ref<string | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
let ticket = 0

watch(
  () => props.open,
  (open) => {
    ticket++
    if (!open) return
    chosen.value = decorKind(props.value) === 'none' ? 'none' : props.value.trim()
    urlDraft.value = decorKind(props.value) === 'url' ? props.value.trim() : ''
    urlProblem.value = null
    uploading.value = false
    failure.value = null
  },
  { immediate: true },
)

async function upload(file: File | undefined) {
  if (!file || uploading.value) return
  if (file.size > MAX_BYTES) {
    failure.value = `${file.name} is over 2 MB`
    return
  }
  if (!TYPES.includes(file.type)) {
    failure.value = `${file.name} isn’t a supported image`
    return
  }
  const mine = ticket
  uploading.value = true
  failure.value = null
  try {
    const uploaded = await decorApi.upload(file)
    rememberDecor({ id: uploaded.id, url: uploaded.url })
    if (mine !== ticket) return
    chosen.value = uploaded.id
    urlDraft.value = ''
  } catch (error) {
    if (mine === ticket) failure.value = errorMessage(error)
  } finally {
    if (mine === ticket) uploading.value = false
  }
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  void upload(input.files?.[0])
  input.value = ''
}

const zone = useTemplateRef<HTMLElement>('zone')
const { isOverDropZone } = useDropZone(zone, {
  onDrop: (files) => void upload(files?.[0]),
})

function chooseAnother() {
  failure.value = null
  fileInput.value?.click()
}

function choose(id: string) {
  chosen.value = id
  urlDraft.value = ''
  urlProblem.value = null
}

function onUrl(event: Event) {
  urlDraft.value = (event.target as HTMLInputElement).value
  urlProblem.value = null
}

function confirm() {
  const url = urlDraft.value.trim()
  if (url !== '' && !isHttpsUrl(url)) {
    urlProblem.value = 'Use an https:// link'
    return
  }
  emit('use', url || chosen.value)
}

const showNone = computed(() => !urlDraft.value.trim())

const tile =
  'flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border text-xs font-semi-bold outline-none focus-visible:shadow-focus-ring'

function selected(id: string) {
  return showNone.value && chosen.value === id
}

function tileClass(id: string) {
  return [
    tile,
    selected(id)
      ? 'border-accent-400 bg-dark-600 text-white'
      : 'border-dark-600 bg-dark-500 text-light-400 hover:text-white',
  ]
}
</script>

<template>
  <UiDialog :open="open" :title="failure ? 'Upload failed' : title" @close="emit('close')">
    <input ref="fileInput" type="file" :accept="TYPES.join(',')" class="hidden" @change="onInput" />

    <template v-if="failure">
      <p class="text-sm text-light-500">We couldn’t add that file to your decor.</p>
      <div
        class="flex flex-col items-center gap-1 rounded-md border border-dark-600 bg-dark-400 px-4 py-9 text-center"
        role="alert"
      >
        <span class="text-sm font-semi-bold break-all text-alert-500">{{ failure }}</span>
        <span class="text-xs text-light-500">{{ RULE }}</span>
      </div>
      <div class="flex justify-end gap-2">
        <UiButton variant="secondary" @click="emit('close')">Cancel</UiButton>
        <UiButton @click="chooseAnother">Choose another</UiButton>
      </div>
    </template>

    <template v-else>
      <p class="text-sm text-light-500">
        Pick a saved decor or upload a new one for your documents.
      </p>
    </template>

    <!-- Kept mounted so that files can still be dropped after a failed upload. -->
    <button
      v-show="!failure"
      ref="zone"
      type="button"
      class="flex flex-col items-center gap-1 rounded-md border bg-dark-400 px-4 py-9 text-center outline-none focus-visible:shadow-focus-ring"
      :class="isOverDropZone ? 'border-accent-400' : 'border-dark-600'"
      :disabled="uploading"
      @click="fileInput?.click()"
    >
      <span class="text-sm font-semi-bold">
        {{ uploading ? 'Uploading…' : 'Drop an image here, or browse' }}
      </span>
      <span class="text-xs text-light-500">PNG, JPG, WebP or SVG · max 2 MB</span>
    </button>

    <template v-if="!failure">
      <div
        class="flex max-h-40 flex-wrap gap-2 overflow-y-auto"
        role="radiogroup"
        :aria-label="title"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="selected('none')"
          :class="tileClass('none')"
          @click="choose('none')"
        >
          None
        </button>
        <button
          v-for="decor in builtins"
          :key="decor.id"
          type="button"
          role="radio"
          :aria-checked="selected(decor.id)"
          :aria-label="decor.label"
          :title="decor.label"
          :class="tileClass(decor.id)"
          @click="choose(decor.id)"
        >
          <img
            :src="resolveApiUrl(decor.thumbUrl)"
            :alt="decor.label"
            class="size-full object-cover"
          />
        </button>
        <button
          v-for="item in recentDecor"
          :key="item.id"
          type="button"
          role="radio"
          :aria-checked="selected(item.id)"
          aria-label="Recent upload"
          title="Recent upload"
          :class="tileClass(item.id)"
          @click="choose(item.id)"
        >
          <img :src="resolveApiUrl(item.url)" alt="Recent upload" class="size-full object-cover" />
        </button>
      </div>
      <p v-if="builtinProblem" class="text-xs text-alert-400" role="alert">{{ builtinProblem }}</p>

      <div class="flex flex-col gap-1">
        <input
          :value="urlDraft"
          type="url"
          placeholder="Or use an image URL (https://…)"
          aria-label="Image URL"
          class="h-9 rounded-md border border-dark-600 bg-dark-400 px-3 text-sm text-white outline-none placeholder:text-light-500 focus:border-accent-400"
          @input="onUrl"
          @keydown.enter.prevent="confirm"
        />
        <p v-if="urlProblem" class="text-xs text-alert-400" role="alert">{{ urlProblem }}</p>
      </div>

      <div class="flex justify-end gap-2">
        <UiButton variant="secondary" @click="emit('close')">Cancel</UiButton>
        <UiButton :disabled="uploading" @click="confirm">Use decor</UiButton>
      </div>
    </template>
  </UiDialog>
</template>