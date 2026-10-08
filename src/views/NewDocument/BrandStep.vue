<script setup lang="ts">
import { NotField, NotForm } from 'notform'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import UiButton from '@/components/ui/UiButton.vue'
import UiColorField from '@/components/ui/UiColorField.vue'
import UiLogoUpload from '@/components/ui/UiLogoUpload.vue'
import UiSectionRow from '@/components/ui/UiSectionRow.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import WizardPreview from '@/components/wizard/WizardPreview.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { ENTITY_TYPES, FONTS } from '@/domain/organization'
import { STEPS, useWizardStore } from '@/stores/wizard'

const router = useRouter()
const wizard = useWizardStore()
const org = computed(() => wizard.organization)

const open = ref<'bank' | 'contact' | null>(null)

const bankSummary = computed(() => {
  const { bankName, accountNumber } = org.value.bank
  if (!bankName && !accountNumber) return 'Add'
  return [bankName, accountNumber ? `••${accountNumber.slice(-4)}` : ''].filter(Boolean).join(' · ')
})
const contactSummary = computed(() => {
  const parts = [org.value.contactEmail, org.value.phone].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Add'
})

function toggle(section: 'bank' | 'contact') {
  open.value = open.value === section ? null : section
}

async function next() {
  const checked = await wizard.organizationForm.validate()
  if (checked.issues) {
    const bad = checked.issues.map((issue) => issue.path?.join('.') ?? '')
    if (bad.some((path) => path === 'contactEmail' || path === 'billingEmail'))
      open.value = 'contact'
    return
  }
  wizard.saveOrganizationProfile()
  void router.push(STEPS[2].path)
}
</script>

<template>
  <WizardShell
    :step="1"
    title="Make it yours"
    subtitle="Fill this once. Every document you create will use it."
  >
    <div class="flex flex-col gap-1.5">
      <p class="text-xs text-light-400">
        The server applies this organisation's branding to the PDF. What you change below is saved
        on this device and overrides the server's values on your documents; anything you leave
        untouched keeps coming from the server.
      </p>
    </div>

    <NotForm :form="wizard.organizationForm" class="flex flex-col gap-3.5" @submit.prevent>
      <UiLogoUpload v-model="org.logo" />

      <div class="grid grid-cols-2 gap-3">
        <UiTextField v-model="org.name" label="Business name" />
        <UiTextField v-model="org.legalName" label="Legal name" />
      </div>

      <div class="grid grid-cols-3 gap-3">
        <UiSelect v-model="org.entityType" label="Entity" :options="ENTITY_TYPES" />
        <UiTextField v-model="org.pan" label="PAN" hint="optional" placeholder="ABCDE0123F" />
        <UiTextField
          v-model="org.gstin"
          label="GSTIN"
          hint="optional"
          placeholder="Not registered"
        />
      </div>

      <div class="grid grid-cols-3 gap-3">
        <NotField v-slot="{ events }" path="primary">
          <UiColorField v-model="org.primary" label="Primary" @focusout="events.onBlur" />
        </NotField>
        <NotField v-slot="{ events }" path="accent">
          <UiColorField v-model="org.accent" label="Accent" @focusout="events.onBlur" />
        </NotField>
        <UiSelect v-model="org.font" label="Font" :options="FONTS" />
      </div>

      <UiSectionRow
        title="Bank details"
        :summary="bankSummary"
        :complete="bankSummary !== 'Add'"
        :expanded="open === 'bank'"
        @click="toggle('bank')"
      />
      <div v-if="open === 'bank'" class="grid grid-cols-2 gap-3" data-testid="bank-fields">
        <UiTextField v-model="org.bank.accountName" label="Account name" />
        <UiTextField v-model="org.bank.bankName" label="Bank name" />
        <UiTextField v-model="org.bank.accountNumber" label="Account number" />
        <UiTextField v-model="org.bank.ifscCode" label="IFSC" />
      </div>

      <UiSectionRow
        title="Contact & socials"
        :summary="contactSummary"
        :complete="contactSummary !== 'Add'"
        :expanded="open === 'contact'"
        @click="toggle('contact')"
      />
      <div v-if="open === 'contact'" class="grid grid-cols-3 gap-3" data-testid="contact-fields">
        <NotField v-slot="{ errors, events }" path="contactEmail">
          <UiTextField
            v-model="org.contactEmail"
            label="Contact email"
            type="email"
            :error="errors[0]?.message"
            @focusout="events.onBlur"
            @input="events.onInput"
          />
        </NotField>
        <NotField v-slot="{ errors, events }" path="billingEmail">
          <UiTextField
            v-model="org.billingEmail"
            label="Billing email"
            type="email"
            :error="errors[0]?.message"
            @focusout="events.onBlur"
            @input="events.onInput"
          />
        </NotField>
        <UiTextField v-model="org.phone" label="Phone" type="tel" />
      </div>
    </NotForm>

    <template #note>
      {{ wizard.organizationSaved ? 'Saved on this device' : 'Unsaved changes' }}
    </template>
    <template #actions>
      <UiButton variant="ghost" @click="router.push(STEPS[0].path)">Back</UiButton>
      <UiButton @click="next">Continue to details</UiButton>
    </template>

    <template #preview>
      <WizardPreview :label="`Preview · ${wizard.template?.label ?? 'Document'} · ${org.id}`" />
    </template>
  </WizardShell>
</template>