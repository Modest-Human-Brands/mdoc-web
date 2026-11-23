<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { termsApi, type TermMeta, type TermStatus } from '@/api'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import UiFilterChip from '@/components/ui/UiFilterChip.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import TermsPicker from '@/components/wizard/TermsPicker.vue'
import { errorMessage } from '@/composables/useTemplates'
import {
  defaultSetSchema,
  listLabels,
  TERM_STATUSES,
  TERM_TEMPLATES,
  termDefaults,
  templateLabel,
  termStatusTone,
  withRequired,
} from '@/domain/terms'

const router = useRouter()

const FILTERS = ['Active', ...TERM_STATUSES] as const
type Filter = (typeof FILTERS)[number]

const filter = ref<Filter>('Active')
const terms = ref<TermMeta[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    // The archive is only returned when asked for by status.
    const [active, archived] = await Promise.all([
      termsApi.list(),
      filter.value === 'Archive' ? termsApi.list({ status: 'Archive' }) : Promise.resolve([]),
    ])
    terms.value = filter.value === 'Archive' ? archived : active
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(filter, load)

const visible = computed(() =>
  filter.value === 'Active'
    ? terms.value.filter((term) => term.status !== 'Archive')
    : terms.value.filter((term) => term.status === (filter.value as TermStatus)),
)

const archiving = ref<TermMeta | null>(null)
const busy = ref(false)

async function confirmArchive() {
  const term = archiving.value
  if (!term) return
  busy.value = true
  error.value = null
  try {
    await termsApi.archive(term.slug)
    notice.value = `${term.title} archived. Existing documents keep their wording.`
    archiving.value = null
    await load()
    await loadDefaultsSource()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

// Default set per template: the Release terms usable on it, in order.
const templateName = ref<string>(TERM_TEMPLATES[0].label)
const templateId = computed(
  () => TERM_TEMPLATES.find((template) => template.label === templateName.value)?.id ?? '',
)
const allTerms = ref<TermMeta[]>([])
const chosen = ref<string[]>([])
const saving = ref(false)
const defaultsError = ref<string | null>(null)

async function loadDefaultsSource() {
  try {
    allTerms.value = await termsApi.list()
  } catch (e) {
    defaultsError.value = errorMessage(e)
  }
}

const defaultsSchema = computed(() => defaultSetSchema(allTerms.value, templateId.value))

watch([allTerms, templateId], () => (chosen.value = termDefaults(defaultsSchema.value)), {
  immediate: true,
})

const defaultsDirty = computed(
  () => JSON.stringify(chosen.value) !== JSON.stringify(termDefaults(defaultsSchema.value)),
)

async function saveDefaults() {
  saving.value = true
  defaultsError.value = null
  try {
    const result = await termsApi.setDefaults(
      templateId.value,
      withRequired(chosen.value, defaultsSchema.value),
    )
    notice.value = `Default terms for ${templateLabel(result.templateId)} saved.`
    await Promise.all([load(), loadDefaultsSource()])
  } catch (e) {
    defaultsError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(loadDefaultsSource)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-dark-400 text-white">
    <header class="flex items-center justify-between px-6 py-4">
      <div class="flex items-center gap-2">
        <span
          class="flex size-6 items-center justify-center rounded-sm bg-white text-xs font-bold text-dark-400"
          aria-hidden="true"
        >
          M
        </span>
        <h1 class="text-base font-bold">MDoc</h1>
      </div>
      <div class="flex items-center gap-2">
        <UiButton variant="ghost" @click="router.push('/documents')">Documents</UiButton>
        <UiButton @click="router.push('/terms/new')">New term</UiButton>
      </div>
    </header>

    <div class="flex min-h-0 flex-1 overflow-auto border-t border-dark-600">
      <section class="flex min-w-0 flex-1 flex-col gap-4 px-6 py-6" aria-label="Terms">
        <h2 class="text-xl font-bold tracking-tight">Terms</h2>
        <p class="text-sm text-light-400">
          Reusable wording that is picked, not typed, when a document is created.
        </p>

        <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          <UiFilterChip
            v-for="option in FILTERS"
            :key="option"
            :label="option"
            :selected="filter === option"
            @click="filter = option"
          />
        </div>

        <p v-if="notice" class="text-sm text-success-400" role="status">{{ notice }}</p>
        <p v-if="error" class="text-sm text-alert-400" role="alert">{{ error }}</p>

        <p v-if="loading" class="text-sm text-light-400">Loading terms…</p>
        <p v-else-if="visible.length === 0" class="text-sm text-light-400">No terms here yet.</p>
        <table v-else class="w-full text-left text-sm">
          <thead class="text-xs text-light-400">
            <tr class="border-b border-dark-600">
              <th class="py-2 pr-3 font-semi-bold">Title</th>
              <th class="py-2 pr-3 font-semi-bold">Type</th>
              <th class="py-2 pr-3 font-semi-bold">Status</th>
              <th class="py-2 pr-3 font-semi-bold">Applies to</th>
              <th class="py-2 pr-3 font-semi-bold">Default for</th>
              <th class="py-2 pr-3 font-semi-bold">Required for</th>
              <th class="py-2 pr-3 font-semi-bold">Version</th>
              <th class="py-2 font-semi-bold"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="term in visible" :key="term.slug" class="border-b border-dark-600 align-top">
              <td class="py-3 pr-3">
                <RouterLink
                  :to="`/terms/${encodeURIComponent(term.slug)}`"
                  class="font-semi-bold text-white hover:underline"
                >
                  {{ term.title }}
                </RouterLink>
              </td>
              <td class="py-3 pr-3 text-light-500">{{ term.type || '—' }}</td>
              <td class="py-3 pr-3" :class="termStatusTone(term.status)">{{ term.status }}</td>
              <td class="py-3 pr-3 text-light-500">{{ listLabels(term.appliesTo, 'Any') }}</td>
              <td class="py-3 pr-3 text-light-500">{{ listLabels(term.defaultFor) }}</td>
              <td class="py-3 pr-3 text-light-500">{{ listLabels(term.requiredFor) }}</td>
              <td class="py-3 pr-3 text-light-500">v{{ term.version }}</td>
              <td class="py-3 text-right">
                <button
                  v-if="term.status !== 'Archive'"
                  type="button"
                  class="text-xs font-semi-bold text-light-400 hover:text-alert-400"
                  :aria-label="`Archive ${term.title}`"
                  @click="archiving = term"
                >
                  Archive
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <aside
        class="flex w-96 shrink-0 flex-col gap-4 border-l border-dark-600 p-6"
        aria-label="Default terms"
      >
        <h2 class="text-lg font-bold">Default terms</h2>
        <p class="text-xs text-light-400">
          The set pre-selected on new documents. Required terms stay on.
        </p>
        <UiSelect
          v-model="templateName"
          label="Template"
          :options="TERM_TEMPLATES.map((template) => template.label)"
        />
        <TermsPicker v-model="chosen" :schema="defaultsSchema" />
        <p v-if="defaultsError" class="text-xs text-alert-400" role="alert">{{ defaultsError }}</p>
        <UiButton :disabled="saving || !defaultsDirty" @click="saveDefaults">
          {{ saving ? 'Saving…' : 'Save default set' }}
        </UiButton>
      </aside>
    </div>

    <UiDialog :open="archiving !== null" title="Archive term" @close="archiving = null">
      <p class="text-sm text-light-500">
        {{ archiving?.title }} is removed from pickers and from every default set. Documents already
        created keep their wording.
      </p>
      <div class="flex justify-end gap-2">
        <UiButton variant="ghost" @click="archiving = null">Cancel</UiButton>
        <UiButton :disabled="busy" @click="confirmArchive">Archive</UiButton>
      </div>
    </UiDialog>
  </div>
</template>