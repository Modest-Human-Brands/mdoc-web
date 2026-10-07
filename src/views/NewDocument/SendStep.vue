<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { documentsApi } from '@/api'
import UiButton from '@/components/ui/UiButton.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import WizardPreview from '@/components/wizard/WizardPreview.vue'
import WizardShell from '@/components/wizard/WizardShell.vue'
import { buildMailto, formatBytes } from '@/domain/format'
import { STEPS, useWizardStore } from '@/stores/wizard'

const router = useRouter()
const wizard = useWizardStore()

const label = computed(() => wizard.template?.label ?? 'Document')
const fileName = computed(() => (wizard.document ? `${wizard.document.name}.pdf` : ''))
const meta = computed(() =>
  `A4 · ${formatBytes(wizard.document?.sizeBytes ?? -1)}`.replace(/ · $/, ''),
)
const downloadUrl = computed(() =>
  wizard.document ? documentsApi.contentUrl(wizard.document.id, { download: true }) : '',
)

function download() {
  const link = document.createElement('a')
  link.href = downloadUrl.value
  link.download = fileName.value
  link.click()
}

function openMail() {
  window.location.href = buildMailto({
    to: wizard.email.to,
    cc: wizard.email.cc,
    subject: wizard.email.subject,
    body: wizard.email.message,
  })
}
</script>

<template>
  <WizardShell
    :step="3"
    title="Send it your way"
    subtitle="Download the PDF, or open your email app with everything filled in."
  >
    <div class="flex h-16.5 items-center gap-3 rounded-lg border border-dark-600 bg-dark-500 p-3">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-md bg-dark-600 text-2xs font-bold tracking-wide text-light-600"
        aria-hidden="true"
      >
        PDF
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-sm font-semi-bold text-white">{{ fileName }}</span>
        <span class="text-xs text-light-400">{{ meta }}</span>
      </span>
      <UiButton variant="secondary" @click="download">Download PDF</UiButton>
    </div>

    <UiTextField v-model="wizard.email.to" label="To" type="email" />
    <UiTextField v-model="wizard.email.cc" label="CC" hint="optional" type="email" />
    <UiTextField v-model="wizard.email.subject" label="Subject" />
    <UiTextField v-model="wizard.email.message" label="Message" multiline :rows="7" />

    <p class="text-xs text-light-400">
      Email apps can't take attachments from a link, so attach the downloaded PDF before you send.
    </p>

    <template #note>Sent from your own email</template>
    <template #actions>
      <UiButton variant="ghost" @click="router.push(STEPS[2].path)">Back</UiButton>
      <UiButton :disabled="!wizard.email.to" @click="openMail">Open in email app</UiButton>
    </template>

    <template #preview>
      <WizardPreview :label="`Final preview · ${label}`" />
    </template>
  </WizardShell>
</template>