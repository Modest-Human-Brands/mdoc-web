<script setup lang="ts">
import IconChevronDown from '~icons/lucide/chevron-down'
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, useId, watch } from 'vue'

import type { FontSummary } from '@/api'
import { DEFAULT_FONT } from '@/domain/organization'

import UiButton from './UiButton.vue'
import UiDialog from './UiDialog.vue'

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
const stage = ref<'closed' | 'choose' | 'unavailable'>('closed')
const query = ref('')
/** Picked in the dialog, but not used until it is confirmed. */
const pending = ref('')
const active = ref(0)

const empty = computed(() => !props.loading && props.options.length === 0)

const searchDebounced = useDebounceFn((value: string) => emit('search', value), props.debounce)

function openChooser() {
  stage.value = 'choose'
  query.value = ''
  pending.value = model.value
  active.value = Math.max(
    0,
    props.options.findIndex((font) => font.family === model.value),
  )
  emit('search', '')
}

function close() {
  stage.value = 'closed'
}

function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value
  active.value = 0
  void searchDebounced(query.value)
}

function pick(index: number) {
  const font = props.options[index]
  if (!font) return
  active.value = index
  pending.value = font.family
}

function use(family: string) {
  model.value = family
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    pick(Math.max(0, Math.min(props.options.length - 1, active.value + step)))
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const font = props.options[active.value]
    if (font) use(font.family)
  }
}

watch(
  () => props.unknown,
  (unknown) => {
    if (unknown) stage.value = 'unavailable'
  },
  { immediate: true },
)

watch(
  () => props.options,
  () => (active.value = Math.min(active.value, Math.max(0, props.options.length - 1))),
)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <span :id="`${id}-label`" class="text-sm font-semi-bold text-light-600">{{ label }}</span>
    <button
      type="button"
      class="flex h-9.5 items-center justify-between gap-2 rounded-md border border-dark-600 bg-dark-500 px-3 text-left text-sm text-white outline-none hover:border-light-400 focus-visible:shadow-focus-ring"
      :aria-labelledby="`${id}-label ${id}-value`"
      aria-haspopup="dialog"
      @click="openChooser"
    >
      <span :id="`${id}-value`" class="truncate">{{ model }}</span>
      <IconChevronDown class="size-3.5 shrink-0 text-light-400" aria-hidden="true" />
    </button>
    <p v-if="unknown" class="text-xs text-alert-400" role="status">
      The server does not know this font and will use {{ DEFAULT_FONT }}.
    </p>

    <UiDialog
      :open="stage !== 'closed'"
      :title="stage === 'unavailable' ? 'Font unavailable' : 'Choose font'"
      @close="close"
    >
      <template v-if="stage === 'unavailable'">
        <p class="text-sm text-light-500">We couldn’t load this font for your document.</p>
        <div
          class="flex flex-col items-center gap-1 rounded-md border border-dark-600 bg-dark-400 px-4 py-9 text-center"
        >
          <span class="text-sm font-semi-bold text-warning-500">
            Falls back to {{ DEFAULT_FONT }}
          </span>
          <span class="text-xs text-light-500"
            >Pick another font or continue with the fallback</span
          >
        </div>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" @click="openChooser">Pick another</UiButton>
          <UiButton @click="use(DEFAULT_FONT)">Use fallback</UiButton>
        </div>
      </template>

      <template v-else-if="stage === 'choose'">
        <p class="text-sm text-light-500">
          Search the font library. Your document uses it for headings and body.
        </p>
        <div class="flex flex-col gap-2 rounded-md border border-dark-600 bg-dark-400 p-3">
          <input
            :value="query"
            role="combobox"
            autocomplete="off"
            spellcheck="false"
            aria-label="Search fonts"
            aria-expanded="true"
            :aria-controls="`${id}-list`"
            :aria-activedescendant="options[active] ? `${id}-option-${active}` : undefined"
            placeholder="Search fonts…"
            autofocus
            class="h-9 rounded-md border border-dark-600 bg-dark-500 px-3 text-sm text-white outline-none placeholder:text-light-500 focus:border-accent-400"
            @input="onInput"
            @keydown="onKeydown"
          />
          <ul
            :id="`${id}-list`"
            role="listbox"
            aria-label="Fonts"
            class="max-h-48 min-h-24 overflow-y-auto"
          >
            <li v-if="loading" class="px-3 py-2 text-sm text-light-400" role="status">
              Searching…
            </li>
            <li v-else-if="empty" class="px-3 py-2 text-sm text-light-400">No fonts found</li>
            <li
              v-for="(font, index) in options"
              :id="`${id}-option-${index}`"
              :key="font.name"
              role="option"
              :aria-selected="font.family === pending"
              class="cursor-pointer rounded-sm px-3 py-2 text-sm text-white hover:bg-dark-600"
              :class="font.family === pending ? 'bg-dark-600' : ''"
              @click="pick(index)"
              @dblclick="use(font.family)"
            >
              {{ font.family }}
            </li>
          </ul>
          <p class="text-center text-xs text-light-500" :style="{ fontFamily: `'${pending}'` }">
            {{ pending }} · The quick brown fox jumps over the lazy dog
          </p>
        </div>
        <p v-if="offline" class="text-xs text-light-400" role="status">
          Font search is unavailable. Showing the built-in font only.
        </p>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" @click="close">Cancel</UiButton>
          <UiButton @click="use(pending)">Use font</UiButton>
        </div>
      </template>
    </UiDialog>
  </div>
</template>