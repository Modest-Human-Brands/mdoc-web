<script setup lang="ts">
import IconChevronDown from '~icons/lucide/chevron-down'
import { computed, onMounted, ref } from 'vue'

import { decorApi, resolveApiUrl, type DecorSummary } from '@/api'
import { errorMessage } from '@/composables/useTemplates'
import { recentDecor } from '@/composables/useRecentDecor'
import { decorKind, describeDecor } from '@/domain/decor'

import DecorDialog from './DecorDialog.vue'

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

const builtins = ref<DecorSummary[]>([])
const problem = ref<string | null>(null)
const open = ref(false)

const kind = computed(() => decorKind(model.value))
const builtin = computed(() => builtins.value.find((decor) => decor.id === model.value.trim()))
const uploaded = computed(() => recentDecor.value.find((item) => item.id === model.value.trim()))
const preview = computed(() => {
  const url = builtin.value?.thumbUrl ?? uploaded.value?.url
  return url ? resolveApiUrl(url) : ''
})
const summary = computed(() => {
  if (kind.value === 'none') return 'None'
  return builtin.value?.label ?? describeDecor(model.value)
})

onMounted(async () => {
  if (props.widget !== 'decor') return
  try {
    builtins.value = await loadBuiltins(props.decorSlot)
  } catch (error) {
    problem.value = errorMessage(error)
  }
})

function use(value: string) {
  model.value = value
  open.value = false
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <span class="flex items-end gap-1.5 text-sm font-semi-bold text-light-600">
      {{ label }}
      <span v-if="hint" class="text-xs font-regular text-light-400">{{ hint }}</span>
    </span>

    <button
      type="button"
      class="flex h-9.5 items-center gap-2 rounded-md border border-dark-600 bg-dark-500 px-3 text-left text-sm text-white outline-none hover:border-light-400 focus-visible:shadow-focus-ring"
      :aria-label="`${label}: ${summary}`"
      aria-haspopup="dialog"
      @click="open = true"
    >
      <img v-if="preview" :src="preview" alt="" class="size-6 shrink-0 rounded-sm object-cover" />
      <span class="min-w-0 flex-1 truncate">{{ summary }}</span>
      <IconChevronDown class="size-3.5 shrink-0 text-light-400" aria-hidden="true" />
    </button>

    <p v-if="error" class="text-xs text-alert-400" role="alert">{{ error }}</p>

    <DecorDialog
      :open="open"
      :title="widget === 'decor' ? 'Choose decor' : 'Choose image'"
      :value="model"
      :builtins="builtins"
      :builtin-problem="problem"
      @close="open = false"
      @use="use"
    />
  </div>
</template>