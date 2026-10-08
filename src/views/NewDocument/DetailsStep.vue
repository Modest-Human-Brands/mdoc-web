<script setup lang="ts">
import { NotForm } from 'notform'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import UiButton from '@/components/ui/UiButton.vue'
import UiCallout from '@/components/ui/UiCallout.vue'
import SchemaFields from '@/components/wizard/SchemaFields.vue'
import WizardPreview from '@/components/wizard/WizardPreview.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { errorMessage } from '@/composables/useTemplates'
import { formatInr } from '@/domain/invoice'
import { STEPS, useWizardStore } from '@/stores/wizard'

const router = useRouter()
const wizard = useWizardStore()

const creating = ref(false)
const createError = ref<string | null>(null)

const label = computed(() => wizard.template?.label ?? 'Document')

const note = computed(() => {
  const [first, ...rest] = wizard.problems
  if (!first) return 'Draft saved on this device'
  return `To continue: ${first.message.toLowerCase()}${rest.length > 0 ? ` (+${rest.length} more)` : ''}`
})

function chooseAnother() {
  wizard.selectTemplate(null)
  void router.push(STEPS[0].path)
}

async function next() {
  createError.value = null
  const checked = await wizard.form.validate()
  if (checked.issues) return
  creating.value = true
  try {
    await wizard.createDocument()
    await router.push(STEPS[3].path)
  } catch (e) {
    createError.value = errorMessage(e)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <WizardShell
    :step="2"
    :title="`${label} details`"
    :subtitle="
      wizard.showAmountDue
        ? 'Numbers and totals are calculated for you.'
        : 'Fill in the fields for this template.'
    "
  >
    <div
      v-if="wizard.templateError"
      class="flex items-center justify-between gap-3 rounded-md bg-alert-600 px-3 py-2 text-sm text-white"
      role="alert"
    >
      Couldn't load this template: {{ wizard.templateError }}
      <button type="button" class="font-semi-bold underline" @click="chooseAnother">
        Choose another template
      </button>
    </div>
    <p v-else-if="!wizard.schema" class="text-sm text-light-400" role="status">Loading fields…</p>

    <template v-else>
      <NotForm :form="wizard.form" @submit.prevent>
        <SchemaFields :schema="wizard.schema" />
      </NotForm>

      <UiCallout
        v-if="wizard.showAmountDue"
        label="Amount due"
        :value="formatInr(wizard.totals.amountDue)"
      />
    </template>

    <p v-if="createError" class="rounded-md bg-alert-600 px-3 py-2 text-sm text-white" role="alert">
      Couldn't create the document: {{ createError }}
    </p>

    <template #note>{{ note }}</template>
    <template #actions>
      <UiButton variant="ghost" @click="router.push(STEPS[1].path)">Back</UiButton>
      <UiButton :disabled="creating || !wizard.schema || !wizard.idsReady" @click="next">
        {{ creating ? 'Creating…' : 'Review & download' }}
      </UiButton>
    </template>

    <template #preview>
      <WizardPreview :label="`Live preview · ${label}`" />
    </template>
  </WizardShell>
</template>