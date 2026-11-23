<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { termsApi, type TermStatus } from '@/api'
import TermsEditor from '@/components/terms/TermsEditor.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import { errorMessage } from '@/composables/useTemplates'
import {
  isValidSlug,
  reconcileLists,
  slugify,
  TERM_STATUSES,
  TERM_TEMPLATES,
  toggleId,
} from '@/domain/terms'

const AUTOSAVE_MS = 1200

const route = useRoute()
const router = useRouter()

const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : ''))
const isNew = computed(() => route.name === 'term-new')

const form = reactive({
  title: '',
  slug: '',
  type: '',
  status: 'Plan' as TermStatus,
  order: '0',
  appliesTo: [] as string[],
  defaultFor: [] as string[],
  requiredFor: [] as string[],
})
const slugTouched = ref(false)
const content = ref<unknown>(null)
const version = ref<number | null>(null)
const loading = ref(!isNew.value)
const loadError = ref<string | null>(null)
const detailsBusy = ref(false)
const detailsError = ref<string | null>(null)
const detailsSaved = ref(false)
const submitted = ref(false)
const contentState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const contentError = ref<string | null>(null)

async function load() {
  if (isNew.value) return
  loading.value = true
  loadError.value = null
  try {
    const term = await termsApi.get(slug.value)
    form.title = term.title
    form.slug = term.slug
    form.type = term.type ?? ''
    form.status = term.status
    form.order = String(term.order)
    form.appliesTo = term.appliesTo
    form.defaultFor = term.defaultFor
    form.requiredFor = term.requiredFor
    content.value = term.content
    version.value = term.version
  } catch (e) {
    loadError.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

watch(
  () => form.title,
  (title) => {
    if (isNew.value && !slugTouched.value) form.slug = slugify(title)
  },
)

const errors = computed(() => {
  if (!submitted.value) return {}
  return {
    title: form.title.trim() === '' ? 'Enter a title' : undefined,
    slug:
      isNew.value && !isValidSlug(form.slug)
        ? 'Use lowercase letters, numbers and hyphens'
        : undefined,
    order: Number.isFinite(Number(form.order)) ? undefined : 'Enter a number',
  }
})

function setLists(next: { appliesTo: string[]; defaultFor: string[]; requiredFor: string[] }) {
  const lists = reconcileLists(next)
  form.appliesTo = lists.appliesTo
  form.defaultFor = lists.defaultFor
  form.requiredFor = lists.requiredFor
  detailsSaved.value = false
}

const toggleApplies = (id: string) => setLists({ ...form, appliesTo: toggleId(form.appliesTo, id) })
const toggleDefault = (id: string) => {
  const on = form.defaultFor.includes(id)
  setLists({
    ...form,
    defaultFor: toggleId(form.defaultFor, id),
    requiredFor: on ? form.requiredFor.filter((item) => item !== id) : form.requiredFor,
  })
}
const toggleRequired = (id: string) =>
  setLists({ ...form, requiredFor: toggleId(form.requiredFor, id) })

async function saveDetails() {
  submitted.value = true
  detailsError.value = null
  const problems = Object.values(errors.value).filter(Boolean)
  if (problems.length > 0) return
  detailsBusy.value = true
  try {
    const payload = {
      title: form.title.trim(),
      type: form.type.trim() || undefined,
      appliesTo: form.appliesTo,
      defaultFor: form.defaultFor,
      requiredFor: form.requiredFor,
      order: Number(form.order),
    }
    if (isNew.value) {
      const created = await termsApi.create({ ...payload, slug: form.slug })
      // The route key changes, so the editor remounts and loads the new term itself.
      await router.replace(`/terms/${encodeURIComponent(created.slug)}`)
    } else {
      await termsApi.updateMeta(slug.value, { ...payload, status: form.status })
      detailsSaved.value = true
    }
  } catch (e) {
    detailsError.value = errorMessage(e)
  } finally {
    detailsBusy.value = false
  }
}

async function saveContent() {
  contentState.value = 'saving'
  contentError.value = null
  try {
    const result = await termsApi.saveContent(slug.value, content.value)
    version.value = result.version
    contentState.value = 'saved'
  } catch (e) {
    contentError.value = errorMessage(e)
    contentState.value = 'error'
  }
}

const autosave = useDebounceFn(saveContent, AUTOSAVE_MS)

function onContent(value: unknown) {
  content.value = value
  if (isNew.value) return
  contentState.value = 'idle'
  void autosave()
}

const contentStatus = computed(() => {
  if (contentState.value === 'saving') return 'Saving…'
  if (contentState.value === 'saved') return 'Saved'
  return ''
})
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
      <RouterLink to="/terms" class="text-sm font-semi-bold text-light-400 hover:text-white">
        All terms
      </RouterLink>
    </header>

    <div class="flex min-h-0 flex-1 gap-6 overflow-auto border-t border-dark-600 px-6 py-6">
      <p v-if="loading" class="text-sm text-light-400">Loading term…</p>
      <p v-else-if="loadError" class="text-sm text-alert-400" role="alert">{{ loadError }}</p>
      <template v-else>
        <section class="flex min-w-0 flex-1 flex-col gap-3" aria-label="Wording">
          <div class="flex items-baseline justify-between">
            <h2 class="text-xl font-bold tracking-tight">
              {{ isNew ? 'New term' : form.title || 'Term' }}
            </h2>
            <span v-if="version !== null" class="text-xs text-light-400">
              Version {{ version }}
              <span v-if="contentStatus" role="status"> · {{ contentStatus }}</span>
            </span>
          </div>
          <p class="text-xs text-light-400">
            Terms are numbered automatically in the PDF, so don’t number them here.
          </p>
          <p v-if="isNew" class="text-sm text-light-400">
            Create the term first, then write its wording here.
          </p>
          <template v-else>
            <TermsEditor :model-value="content" @update:model-value="onContent" />
            <p v-if="contentError" class="text-xs text-alert-400" role="alert">
              {{ contentError }}
              <button type="button" class="underline" @click="saveContent">Retry</button>
            </p>
          </template>
        </section>

        <form
          class="flex w-96 shrink-0 flex-col gap-4"
          aria-label="Details"
          novalidate
          @submit.prevent="saveDetails"
        >
          <UiTextField v-model="form.title" label="Title" :error="errors.title" />
          <UiTextField
            v-model="form.slug"
            label="Slug"
            :readonly="!isNew"
            :error="errors.slug"
            @update:model-value="slugTouched = true"
          />
          <UiTextField v-model="form.type" label="Type" hint="optional" />
          <UiSelect
            v-if="!isNew"
            :model-value="form.status"
            label="Status"
            :options="TERM_STATUSES"
            @update:model-value="
              (v) => {
                form.status = v
                detailsSaved = false
              }
            "
          />
          <UiTextField v-model="form.order" label="Order" numeric :error="errors.order" />

          <fieldset class="flex flex-col gap-1.5">
            <legend class="text-sm font-semi-bold text-light-600">Applies to</legend>
            <p class="text-xs text-light-400">None selected means any template.</p>
            <label
              v-for="template in TERM_TEMPLATES"
              :key="template.id"
              class="flex items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                :checked="form.appliesTo.includes(template.id)"
                @change="toggleApplies(template.id)"
              />
              {{ template.label }}
            </label>
          </fieldset>

          <fieldset class="flex flex-col gap-1.5">
            <legend class="text-sm font-semi-bold text-light-600">Default for</legend>
            <label
              v-for="template in TERM_TEMPLATES"
              :key="template.id"
              class="flex items-center gap-2 text-sm"
              :class="
                form.appliesTo.length > 0 && !form.appliesTo.includes(template.id)
                  ? 'text-light-400'
                  : ''
              "
            >
              <input
                type="checkbox"
                :checked="form.defaultFor.includes(template.id)"
                :disabled="form.appliesTo.length > 0 && !form.appliesTo.includes(template.id)"
                @change="toggleDefault(template.id)"
              />
              {{ template.label }}
            </label>
          </fieldset>

          <fieldset class="flex flex-col gap-1.5">
            <legend class="text-sm font-semi-bold text-light-600">Required for</legend>
            <p class="text-xs text-light-400">A required term is always a default.</p>
            <label
              v-for="template in TERM_TEMPLATES"
              :key="template.id"
              class="flex items-center gap-2 text-sm"
              :class="
                form.appliesTo.length > 0 && !form.appliesTo.includes(template.id)
                  ? 'text-light-400'
                  : ''
              "
            >
              <input
                type="checkbox"
                :checked="form.requiredFor.includes(template.id)"
                :disabled="form.appliesTo.length > 0 && !form.appliesTo.includes(template.id)"
                @change="toggleRequired(template.id)"
              />
              {{ template.label }}
            </label>
          </fieldset>

          <p v-if="detailsError" class="text-sm text-alert-400" role="alert">{{ detailsError }}</p>
          <p v-if="detailsSaved" class="text-sm text-success-400" role="status">Details saved.</p>
          <UiButton type="submit" :disabled="detailsBusy">
            {{ detailsBusy ? 'Saving…' : isNew ? 'Create term' : 'Save details' }}
          </UiButton>
        </form>
      </template>
    </div>
  </div>
</template>