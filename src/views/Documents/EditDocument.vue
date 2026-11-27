<script setup lang="ts">
import { NotForm } from 'notform'
import { computed, nextTick, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { documentsApi, fetchTemplateDetail } from '@/api'
import UiButton from '@/components/ui/UiButton.vue'
import UiCallout from '@/components/ui/UiCallout.vue'
import SchemaFields from '@/components/wizard/SchemaFields.vue'
import WizardPreview from '@/components/wizard/WizardPreview.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { errorMessage } from '@/composables/useTemplates'
import { isDraft } from '@/domain/documents'
import { formatInr } from '@/domain/invoice'
import { BRAND_PATH, useWizardStore } from '@/stores/wizard'

const route = useRoute()
const router = useRouter()
const wizard = useWizardStore()
const id = computed(() => String(route.params.id))

const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const saving = ref(false)

const ready = computed(() => wizard.editing?.id === id.value && wizard.schema !== null)
const label = computed(() => wizard.template?.label ?? 'Document')
const note = computed(() => {
  if (!ready.value) return ''
  const [first, ...rest] = wizard.problems
  if (first) {
    return `To continue: ${first.message.toLowerCase()}${rest.length > 0 ? ` (+${rest.length} more)` : ''}`
  }
  return wizard.hasUnsavedEdits ? 'Unsaved changes' : 'No changes yet'
})

async function load() {
  loadError.value = null
  saveError.value = null
  // Coming back from the brand screen keeps what was already typed.
  if (wizard.editing?.id === id.value) return
  try {
    const document = await documentsApi.get(id.value)
    if (!isDraft(document.status)) {
      throw new Error(`Only a Draft can be edited. This document is ${document.status}.`)
    }
    if (!document.templateId || !document.rawData) {
      throw new Error('This document has no saved form data, so it cannot be edited.')
    }
    // Not the cached copy: the terms on offer may have changed since the template was last read.
    const template = await fetchTemplateDetail(document.templateId, { fresh: true })
    // The reader may have left this page while it was loading.
    if (route.name !== 'document-edit' || document.id !== id.value) return
    wizard.startEditing(document, template)
  } catch (error) {
    loadError.value = errorMessage(error)
  }
}

watch(id, load, { immediate: true })

async function reload() {
  wizard.stopEditing()
  await load()
}

function leave() {
  void router.push(`/documents/${id.value}`)
}

// Covers Cancel, Close and the browser's Back button. The brand screen returns here with the edits intact.
onBeforeRouteLeave((to) => {
  if (to.name === 'brand' || !wizard.hasUnsavedEdits) return true
  return window.confirm('Discard your changes to this document?')
})

async function save() {
  saveError.value = null
  wizard.submitAttempted = true
  const checked = await wizard.form.validate()
  if (checked.issues) {
    await nextTick()
    const first = document.querySelector<HTMLElement>('[aria-invalid="true"]')
    first?.focus()
    first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }
  saving.value = true
  try {
    await wizard.saveDocumentEdits()
    leave()
  } catch (error) {
    saveError.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <WizardShell
    :title="ready ? `Edit ${wizard.editing?.name}` : 'Edit document'"
    :subtitle="`${label} · the template cannot be changed.`"
    @close="leave"
  >
    <p v-if="loadError" class="rounded-md bg-alert-600 px-3 py-2 text-sm text-white" role="alert">
      Couldn't open this document for editing: {{ loadError }}
    </p>
    <p v-else-if="!ready" class="text-sm text-light-400" role="status">Loading document…</p>

    <template v-else>
      <p
        v-if="wizard.editing?.droppedTerms.length"
        class="rounded-md border border-alert-400 px-3 py-2 text-sm text-alert-400"
        role="alert"
      >
        No longer available, so saving removes: {{ wizard.editing.droppedTerms.join(', ') }}.
      </p>

      <NotForm :form="wizard.form" @submit.prevent>
        <SchemaFields :schema="wizard.schema!" />
      </NotForm>

      <UiCallout
        v-if="wizard.showAmountDue"
        label="Amount due"
        :value="formatInr(wizard.totals.amountDue)"
      />
      <p class="text-xs text-light-400">
        Saving replaces the PDF. It uses your current branding and the latest wording of each term.
        The document keeps its link.
      </p>
    </template>

    <div
      v-if="saveError"
      class="flex items-center justify-between gap-3 rounded-md bg-alert-600 px-3 py-2 text-sm text-white"
      role="alert"
    >
      Couldn't save: {{ saveError }}
      <button type="button" class="shrink-0 font-semi-bold underline" @click="reload">
        Reload document
      </button>
    </div>

    <template #note>{{ note }}</template>
    <template #actions>
      <UiButton
        variant="ghost"
        @click="router.push({ path: BRAND_PATH, query: { from: route.fullPath } })"
      >
        Change branding
      </UiButton>
      <UiButton variant="ghost" @click="leave">Cancel</UiButton>
      <UiButton :disabled="saving || !ready" @click="save">
        {{ saving ? 'Saving…' : 'Save changes' }}
      </UiButton>
    </template>

    <template #preview>
      <WizardPreview v-if="ready" :label="`Live preview · ${label}`" variant="filled" />
    </template>
  </WizardShell>
</template>