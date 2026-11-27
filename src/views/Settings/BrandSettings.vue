<script setup lang="ts">
import { NotField, NotForm } from 'notform'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import UiButton from '@/components/ui/UiButton.vue'
import UiColorField from '@/components/ui/UiColorField.vue'
import UiQrCustomizer from '@/components/ui/UiQrCustomizer.vue'
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
const route = useRoute()
const wizard = useWizardStore()
const org = computed(() => wizard.organization)
const loaded = computed(() => wizard.organizationRevision !== null)
const busy = computed(
  () => wizard.organizationStatus === 'loading' || wizard.organizationStatus === 'saving',
)
const note = computed(() => {
  if (wizard.organizationStatus === 'loading') return 'Loading from Notion…'
  if (wizard.organizationStatus === 'saving') return 'Saving to Notion…'
  if (!loaded.value) return 'Not loaded'
  return wizard.organizationSaved ? 'Saved to Notion' : 'Unsaved changes'
})

const {
  fonts,
  loading: fontsLoading,
  offline: fontsOffline,
  search: searchFonts,
  isKnown,
} = useFonts()
const fontUnknown = ref(false)

async function checkFont() {
  fontUnknown.value = (await isKnown(org.value.font)) === false
}

function chooseFont(family: string) {
  org.value.font = family
  // Anything picked here came from the library, or is the fallback.
  fontUnknown.value = false
}

onMounted(async () => {
  void searchFonts('')
  await wizard.ensureOrganization()
  await checkFont()
})

async function reload() {
  if (await wizard.loadOrganizationProfile()) await checkFont()
}

const open = ref<'bank' | 'contact' | 'online' | 'qr' | null>(null)

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

const qrSummary = computed(() => {
  const { color, eyeShape, logo } = org.value.qr
  const colors = color === 'brand' ? 'Brand colors' : 'Monochrome'
  return `${colors} · ${eyeShape[0]!.toUpperCase()}${eyeShape.slice(1)} eyes · Logo ${logo ? 'on' : 'off'}`
})

function toggle(section: 'bank' | 'contact' | 'online' | 'qr') {
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
  if (await wizard.saveOrganizationProfile()) leave()
}

function leave() {
  const from = typeof route.query.from === 'string' ? route.query.from : STEPS[0].path
  void router.push(from)
}

function cancel() {
  wizard.discardOrganizationChanges()
  leave()
}
</script>

<template>
  <WizardShell
    title="Brand"
    subtitle="Saved to your organisation in Notion. Every document you create uses it."
    @close="cancel"
  >
    <div
      v-if="wizard.organizationError"
      class="mb-3.5 flex items-start gap-3 rounded-md border border-alert-400 p-3"
      role="alert"
    >
      <p class="min-w-0 flex-1 text-sm text-alert-400">{{ wizard.organizationError }}</p>
      <UiButton variant="ghost" :disabled="busy" @click="reload">Reload from Notion</UiButton>
    </div>

    <NotForm :form="wizard.organizationForm" class="flex flex-col gap-3.5" @submit.prevent>
      <fieldset class="contents" :disabled="!loaded || busy">
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
          <UiTextField v-model="org.pan" label="PAN" hint="optional" placeholder="AAAAA0000A" />
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
            :model-value="org.font"
            @update:model-value="chooseFont"
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
          <UiTextField
            v-model="org.bank.upiId"
            label="UPI ID"
            hint="optional"
            placeholder="name@bank"
            class="col-span-2"
          />
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
        <UiSectionRow
          title="QR code"
          :summary="qrSummary"
          complete
          :expanded="open === 'qr'"
          @click="toggle('qr')"
        />
        <UiQrCustomizer
          v-if="open === 'qr'"
          v-model="org.qr"
          :accent="org.accent"
          :logo="org.logo?.dataUrl"
        />
      </fieldset>
    </NotForm>

    <template #note>
      {{ note }}
    </template>
    <template #actions>
      <UiButton variant="ghost" @click="cancel">Cancel</UiButton>
      <UiButton :disabled="!loaded || busy" @click="next">Save & continue</UiButton>
    </template>

    <template #preview>
      <WizardPreview
        :label="`Preview · ${wizard.template?.shortLabel ?? 'Document'} · Branded`"
        variant="branded"
      />
    </template>
  </WizardShell>
</template>