<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import UiButton from '@/components/ui/UiButton.vue'
import UiCallout from '@/components/ui/UiCallout.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
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

async function next() {
  creating.value = true
  createError.value = null
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
    <p v-if="!wizard.schema" class="text-sm text-light-400" role="status">Loading fields…</p>

    <template v-else>
      <section class="flex flex-col gap-3">
        <h3 class="text-xs tracking-[0.06em] text-light-400 uppercase">Saving as</h3>
        <div class="grid grid-cols-2 gap-3">
          <UiTextField
            v-model="wizard.ids.userId"
            label="User ID"
            placeholder="Notion user id"
            :error="wizard.fieldErrors.userId"
          />
          <UiTextField
            v-model="wizard.ids.contactId"
            label="Contact ID"
            placeholder="Notion contact id"
            :error="wizard.fieldErrors.contactId"
          />
          <UiTextField
            v-model="wizard.ids.projectId"
            label="Project ID"
            hint="optional"
            placeholder="Notion project id"
            class="col-span-2"
          />
        </div>
      </section>

      <SchemaFields :schema="wizard.schema" />

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
      <UiButton :disabled="creating || !wizard.schema || wizard.problems.length > 0" @click="next">
        {{ creating ? 'Creating…' : 'Review & send' }}
      </UiButton>
    </template>

    <template #preview>
      <WizardPreview :label="`Live preview · ${label}`" />
    </template>
  </WizardShell>
</template>