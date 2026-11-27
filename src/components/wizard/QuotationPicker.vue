<script setup lang="ts">
import IconChevronDown from '~icons/lucide/chevron-down'
import { computed, onMounted, ref, useId } from 'vue'

import { documentsApi, type DocumentListItem } from '@/api'
import UiTextField from '@/components/ui/UiTextField.vue'
import { errorMessage } from '@/composables/useTemplates'
import { formatDay } from '@/domain/documents'
import {
  pickableQuotations,
  QUOTATION_TEMPLATE_ID,
  quotationReference,
  type QuotationReference,
} from '@/domain/quotation'

const CURRENT = '__current'
const MANUAL = '__manual'
const NONE = '__none'
const LIMIT = 100

const model = defineModel<string>({ default: '' })
defineProps<{ error?: string }>()
const emit = defineEmits<{ picked: [reference: QuotationReference]; cleared: [] }>()

const id = useId()
const quotations = ref<DocumentListItem[]>([])
const state = ref<'loading' | 'ready' | 'failed'>('loading')
const manual = ref(false)
const busy = ref(false)
const pickError = ref<string | null>(null)
let ticket = 0

async function load() {
  state.value = 'loading'
  try {
    const response = await documentsApi.list({ templateId: QUOTATION_TEMPLATE_ID, limit: LIMIT })
    quotations.value = pickableQuotations(response.results)
    state.value = 'ready'
  } catch {
    state.value = 'failed'
  }
}

onMounted(load)

// With nothing to pick from, the number has to be typed.
const typed = computed(
  () =>
    manual.value ||
    state.value === 'failed' ||
    (state.value === 'ready' && quotations.value.length === 0),
)

async function choose(event: Event) {
  const select = event.target as HTMLSelectElement
  const value = select.value
  // The field shows the quotation number, not the option that was clicked.
  select.value = model.value ? CURRENT : ''
  const mine = ++ticket
  pickError.value = null
  if (value === MANUAL) {
    manual.value = true
    return
  }
  if (value === NONE) {
    busy.value = false
    model.value = ''
    emit('cleared')
    return
  }
  busy.value = true
  try {
    const reference = quotationReference(await documentsApi.get(value))
    if (mine !== ticket) return
    if (!reference) throw new Error('That quotation has no quotation number saved.')
    model.value = reference.number
    emit('picked', reference)
  } catch (e) {
    if (mine === ticket) pickError.value = errorMessage(e)
  } finally {
    if (mine === ticket) busy.value = false
  }
}
</script>

<template>
  <div v-if="typed" class="flex min-w-0 flex-col gap-1.5">
    <UiTextField v-model="model" label="From quotation" :error="error" />
    <button
      v-if="state === 'failed'"
      type="button"
      class="self-start text-xs font-semi-bold text-light-400 hover:text-white"
      @click="load"
    >
      Couldn’t load quotations. Retry
    </button>
    <button
      v-else-if="quotations.length > 0"
      type="button"
      class="self-start text-xs font-semi-bold text-light-400 hover:text-white"
      @click="manual = false"
    >
      Choose a saved quotation
    </button>
  </div>
  <div v-else class="flex min-w-0 flex-col gap-1.5">
    <label :for="id" class="text-sm font-semi-bold text-light-600">From quotation</label>
    <div
      class="relative flex h-9.5 items-center rounded-md border bg-dark-500 focus-within:border-accent-400 focus-within:shadow-[inset_0_0_0_0.5px_var(--color-accent-400),var(--shadow-focus-ring)]"
      :class="error || pickError ? 'border-alert-500' : 'border-dark-600'"
    >
      <select
        :id="id"
        :value="model ? CURRENT : ''"
        :disabled="state === 'loading' || busy"
        :aria-invalid="error ? true : undefined"
        class="size-full appearance-none truncate rounded-md bg-transparent pr-8 pl-3 text-sm text-white outline-none"
        @change="choose"
      >
        <option v-if="model" :value="CURRENT" hidden>{{ model }}</option>
        <option v-else value="" hidden>
          {{ state === 'loading' ? 'Loading quotations…' : 'Choose a quotation' }}
        </option>
        <option v-for="item in quotations" :key="item.id" :value="item.id" class="bg-dark-500">
          {{ item.name }}{{ item.createdAt ? ` · ${formatDay(item.createdAt)}` : '' }}
        </option>
        <option :value="NONE" class="bg-dark-500">No quotation</option>
        <option :value="MANUAL" class="bg-dark-500">Enter the number myself</option>
      </select>
      <IconChevronDown
        class="pointer-events-none absolute right-3 size-3.5 text-light-400"
        aria-hidden="true"
      />
    </div>
    <p v-if="pickError || error" class="text-xs text-alert-400" role="alert">
      {{ pickError ?? error }}
    </p>
  </div>
</template>