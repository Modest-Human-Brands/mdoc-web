<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'

import { decorApi, resolveApiUrl, type DecorSummary } from '@/api'
import { errorMessage } from '@/composables/useTemplates'
import { recentDecor, rememberDecor } from '@/composables/useRecentDecor'
import { decorKind } from '@/domain/decor'
import { isHttpsUrl } from '@/domain/url'

const model = defineModel<string>({ default: '' })

const builtinCache = new Map<string, Promise<DecorSummary[]>>()

function loadBuiltins(slot: string | undefined): Promise<DecorSummary[]> {
  const key = slot ?? ''
  let pending = builtinCache.get(key)
  if (!pending) {
    pending = decorApi.list(slot)
    builtinCache.set(key, pending)
    pending.catch(() => builtinCache.delete(key))
  }
  return pending
}

const props = defineProps<{
  label: string
  widget: 'decor' | 'image'
  decorSlot?: string
  hint?: string
  error?: string
}>()

const MAX_BYTES = 2 * 1024 * 1024

const builtins = ref<DecorSummary[]>([])
const uploading = ref(false)
const problem = ref<string | null>(null)
const urlDraft = ref(decorKind(model.value) === 'url' ? model.value : '')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const showBuiltins = computed(() => props.widget === 'decor')
const current = computed(() => (decorKind(model.value) === 'none' ? 'none' : model.value.trim()))

onMounted(async () => {
  if (!showBuiltins.value) return
  try {
    builtins.value = await loadBuiltins(props.decorSlot)
  } catch (error) {
    problem.value = errorMessage(error)
  }
})

function choose(id: string) {
  problem.value = null
  model.value = id
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > MAX_BYTES) {
    problem.value = 'Image is larger than 2 MB'
    return
  }
  uploading.value = true
  problem.value = null
  try {
    const uploaded = await decorApi.upload(file)
    rememberDecor({ id: uploaded.id, url: uploaded.url })
    model.value = uploaded.id
  } catch (error) {
    problem.value = errorMessage(error)
  } finally {
    uploading.value = false
  }
}

function applyUrl() {
  const url = urlDraft.value.trim()
  if (url === '') {
    choose('none')
    return
  }
  if (!isHttpsUrl(url)) {
    problem.value = 'Use an https:// link'
    return
  }
  choose(url)
}

const tile =
  'flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border text-xs font-semi-bold outline-none focus-visible:shadow-focus-ring'

function tileClass(id: string) {
  return [
    tile,
    current.value === id
      ? 'border-accent-400 bg-dark-600 text-white'
      : 'border-dark-600 bg-dark-500 text-light-400 hover:text-white',
  ]
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <span class="flex items-end gap-1.5 text-sm font-semi-bold text-light-600">
      {{ label }}
      <span v-if="hint" class="text-xs font-regular text-light-400">{{ hint }}</span>
    </span>

    <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="label">
      <button
        type="button"
        role="radio"
        :aria-checked="current === 'none'"
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
        :aria-checked="current === decor.id"
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
        v-for="upload in recentDecor"
        :key="upload.id"
        type="button"
        role="radio"
        :aria-checked="current === upload.id"
        aria-label="Recent upload"
        title="Recent upload"
        :class="tileClass(upload.id)"
        @click="choose(upload.id)"
      >
        <img :src="resolveApiUrl(upload.url)" alt="Recent upload" class="size-full object-cover" />
      </button>
    </div>

    <div class="flex items-center gap-2">
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        class="hidden"
        @change="onFile"
      />
      <button
        type="button"
        class="rounded-md border border-dark-600 bg-dark-500 px-3 py-1.5 text-sm font-semi-bold text-white outline-none hover:bg-dark-600 focus-visible:shadow-focus-ring disabled:opacity-50"
        :disabled="uploading"
        @click="fileInput?.click()"
      >
        {{ uploading ? 'Uploading…' : 'Upload' }}
      </button>
      <input
        v-model="urlDraft"
        type="url"
        placeholder="From URL (https://…)"
        :aria-label="`${label} image URL`"
        class="h-9 min-w-0 flex-1 rounded-md border border-dark-600 bg-dark-500 px-3 text-sm text-white outline-none placeholder:text-light-400 focus:border-accent-400"
        @keydown.enter.prevent="applyUrl"
      />
      <button
        type="button"
        class="text-sm font-semi-bold text-accent-400 outline-none hover:text-accent-500 focus-visible:shadow-focus-ring"
        @click="applyUrl"
      >
        Use
      </button>
    </div>

    <p v-if="problem || error" class="text-xs text-alert-400" role="alert">
      {{ problem ?? error }}
    </p>
  </div>
</template>