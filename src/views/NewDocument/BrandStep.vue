<script setup lang="ts">
import { NotField, NotForm } from 'notform'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import UiButton from '@/components/ui/UiButton.vue'
import UiColorField from '@/components/ui/UiColorField.vue'
import UiLogoUpload from '@/components/ui/UiLogoUpload.vue'
import UiSectionRow from '@/components/ui/UiSectionRow.vue'
import UiFontPicker from '@/components/ui/UiFontPicker.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import WizardPreview from '@/components/wizard/WizardPreview.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { useFonts } from '@/composables/useFonts'
import {
  ENTITY_TYPES,
  SOCIAL_KEYS,
  TRADE_RELATIONSHIPS,
  type SocialKey,
} from '@/domain/organization'
import { STEPS, useWizardStore } from '@/stores/wizard'

const router = useRouter()
const wizard = useWizardStore()
const org = computed(() => wizard.organization)

const {
  fonts,
  loading: fontsLoading,
  offline: fontsOffline,
  search: searchFonts,
  isKnown,
} = useFonts()
const fontUnknown = ref(false)

onMounted(async () => {
  void searchFonts('')
  fontUnknown.value = (await isKnown(org.value.font)) === false
})

const open = ref<'bank' | 'contact' | 'online' | null>(null)

const SOCIAL_LABELS: Record<SocialKey, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
}

const bankSummary = computed(() => {
  const { bankName, accountNumber } = org.value.bank
  if (!bankName && !accountNumber) return 'Add'
  return [bankName, accountNumber ? `••${accountNumber.slice(-4)}` : ''].filter(Boolean).join(' · ')
})
const contactSummary = computed(() => {
  const parts = [org.value.contactEmail, org.value.phone].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Add'
})

const onlineSummary = computed(() => {
  const parts = [org.value.website, ...Object.values(org.value.socials)].filter(Boolean)
  return parts.length > 0 ? `${parts.length} added` : 'Add'
})

function toggle(section: 'bank' | 'contact' | 'online') {
  open.value = open.value === section ? null : section
}

async function next() {
  const checked = await wizard.organizationForm.validate()
  if (checked.issues) {
    const bad = checked.issues.map((issue) => issue.path?.join('.') ?? '')
    if (bad.some((path) => path === 'contactEmail' || path === 'billingEmail'))
      open.value = 'contact'
    else if (bad.some((path) => path === 'website' || path.startsWith('socials.')))
      open.value = 'online'
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
    <NotForm :form="wizard.organizationForm" class="flex flex-col gap-3.5" @submit.prevent>
      <UiLogoUpload v-model="org.logo" />

      <div class="grid grid-cols-2 gap-3">
        <UiTextField v-model="org.name" label="Business name" />
        <UiTextField v-model="org.legalName" label="Legal name" />
      </div>

      <UiTextField v-model="org.address" label="Address" hint="optional" multiline :rows="3" />

      <div class="grid grid-cols-3 gap-3">
        <UiSelect v-model="org.entityType" label="Entity" :options="ENTITY_TYPES" />
        <UiSelect
          v-model="org.tradeRelationship"
          label="Trade relationship"
          :options="TRADE_RELATIONSHIPS"
        />
        <NotField v-slot="{ errors, events }" path="foundedYear">
          <UiTextField
            v-model="org.foundedYear"
            label="Founded"
            hint="optional"
            placeholder="2025"
            :error="errors[0]?.message"
            @focusout="events.onBlur"
            @input="events.onInput"
          />
        </NotField>
      </div>

      <div class="grid grid-cols-2 gap-3">
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
        <UiFontPicker
          v-model="org.font"
          label="Font"
          :options="fonts"
          :loading="fontsLoading"
          :offline="fontsOffline"
          :unknown="fontUnknown"
          @search="searchFonts"
        />
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
        title="Contact"
        :summary="contactSummary"
        :complete="contactSummary !== 'Add'"
        :expanded="open === 'contact'"
        @click="toggle('contact')"
      />
      <div v-if="open === 'contact'" class="grid grid-cols-2 gap-3" data-testid="contact-fields">
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
        <UiTextField v-model="org.whatsapp" label="WhatsApp" type="tel" hint="optional" />
      </div>

      <UiSectionRow
        title="Website & socials"
        :summary="onlineSummary"
        :complete="onlineSummary !== 'Add'"
        :expanded="open === 'online'"
        @click="toggle('online')"
      />
      <div v-if="open === 'online'" class="grid grid-cols-2 gap-3" data-testid="online-fields">
        <NotField v-slot="{ errors, events }" path="website">
          <UiTextField
            v-model="org.website"
            label="Website"
            placeholder="https://"
            class="col-span-2"
            :error="errors[0]?.message"
            @focusout="events.onBlur"
            @input="events.onInput"
          />
        </NotField>
        <NotField
          v-for="key in SOCIAL_KEYS"
          :key="key"
          v-slot="{ errors, events }"
          :path="`socials.${key}`"
        >
          <UiTextField
            v-model="org.socials[key]"
            :label="SOCIAL_LABELS[key]"
            placeholder="https://"
            :error="errors[0]?.message"
            @focusout="events.onBlur"
            @input="events.onInput"
          />
        </NotField>
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
      <WizardPreview
        :label="`Preview · ${wizard.template?.shortLabel ?? 'Document'} · Branded`"
        variant="branded"
      />
    </template>
  </WizardShell>
</template>