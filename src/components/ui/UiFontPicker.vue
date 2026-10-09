<script setup lang="ts">
import IconChevronDown from '~icons/lucide/chevron-down'
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, useId, watch } from 'vue'

import type { FontSummary } from '@/api'

const model = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    label: string
    options: FontSummary[]
    loading?: boolean
    offline?: boolean
    unknown?: boolean
    debounce?: number
  }>(),
  { debounce: 250 },
)

const emit = defineEmits<{ search: [query: string] }>()

const id = useId()
const open = ref(false)
const query = ref('')
const active = ref(0)

const shown = computed(() => (open.value ? query.value : model.value))
const empty = computed(() => !props.loading && props.options.length === 0)

const searchDebounced = useDebounceFn((value: string) => emit('search', value), props.debounce)

function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value
  open.value = true
  active.value = 0
  void searchDebounced(query.value)
}

function openList() {
  if (open.value) return
  open.value = true
  query.value = ''
  active.value = Math.max(
    0,
    props.options.findIndex((font) => font.family === model.value),
  )
  emit('search', '')
}

function close() {
  open.value = false
  query.value = ''
}

function choose(font: FontSummary) {
  model.value = font.family
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) return openList()
    const last = props.options.length - 1
    active.value =
      event.key === 'ArrowDown' ? Math.min(last, active.value + 1) : Math.max(0, active.value - 1)
  } else if (event.key === 'Enter' && open.value) {
    event.preventDefault()
    const font = props.options[active.value]
    if (font) choose(font)
  } else if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close()
  }
}

watch(
  () => props.options,
  () => (active.value = Math.min(active.value, Math.max(0, props.options.length - 1))),
)
</script>

<template>
  <div class="relative flex min-w-0 flex-col gap-1.5">
    <label :for="id" class="text-sm font-semi-bold text-light-600">{{ label }}</label>
    <div
      class="relative flex h-9.5 items-center rounded-md border border-dark-600 bg-dark-500 focus-within:border-accent-400 focus-within:shadow-[inset_0_0_0_0.5px_var(--color-accent-400),var(--shadow-focus-ring)]"
    >
      <input
        :id="id"
        :value="shown"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        :aria-expanded="open"
        :aria-controls="`${id}-list`"
        :aria-activedescendant="open ? `${id}-option-${active}` : undefined"
        placeholder="Search fonts"
        class="size-full rounded-md bg-transparent pr-8 pl-3 text-sm text-white outline-none placeholder:text-light-400"
        @focus="openList"
        @click="openList"
        @input="onInput"
        @keydown="onKeydown"
        @blur="close"
      />
      <IconChevronDown
        class="pointer-events-none absolute right-3 size-3.5 text-light-400"
        aria-hidden="true"
      />
    </div>

    <ul
      v-if="open"
      :id="`${id}-list`"
      role="listbox"
      class="absolute top-full right-0 left-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-dark-600 bg-dark-500 py-1 shadow-doc-page"
    >
      <li v-if="loading" class="px-3 py-2 text-sm text-light-400" role="status">Searching…</li>
      <li v-else-if="empty" class="px-3 py-2 text-sm text-light-400">No fonts found</li>
      <li
        v-for="(font, index) in options"
        :id="`${id}-option-${index}`"
        :key="font.name"
        role="option"
        :aria-selected="font.family === model"
        class="cursor-pointer px-3 py-2 text-sm text-white"
        :class="index === active ? 'bg-dark-600' : ''"
        @mousedown.prevent="choose(font)"
        @mousemove="active = index"
      >
        {{ font.family }}
      </li>
    </ul>

    <p v-if="offline" class="text-xs text-light-400" role="status">
      Font search is unavailable. Showing the built-in font only.
    </p>
    <p v-else-if="unknown" class="text-xs text-alert-400" role="status">
      The server does not know this font and will use Exo 2.
    </p>
  </div>
</template>