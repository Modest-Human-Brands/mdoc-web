<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

import { mstudioApi, MStudioError, type TokenCertificate } from '@/api/mstudio'
import UiButton from '@/components/ui/UiButton.vue'
import UiDialog from '@/components/ui/UiDialog.vue'
import { commonName, readCertificate } from '@/domain/certificates'
import { formatDay } from '@/domain/documents'
import { errorMessage } from '@/composables/useTemplates'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; sign: [certificate: TokenCertificate] }>()

type Stage = 'plug' | 'checking' | 'pick' | 'none' | 'offline' | 'failed'

const stage = ref<Stage>('plug')
const certificates = shallowRef<TokenCertificate[]>([])
const chosen = ref<number | null>(null)
const failure = ref('')
let ticket = 0

watch(
  () => props.open,
  (open) => {
    ticket++
    if (open) stage.value = 'plug'
  },
)

async function detect() {
  const mine = ++ticket
  stage.value = 'checking'
  try {
    const found = await mstudioApi.certificates()
    if (mine !== ticket) return
    certificates.value = found
    chosen.value = found.length === 1 ? (found[0]?.index ?? null) : null
    stage.value = found.length > 0 ? 'pick' : 'none'
  } catch (error) {
    if (mine !== ticket) return
    failure.value = errorMessage(error)
    stage.value = error instanceof MStudioError && !error.reachable ? 'offline' : 'failed'
  }
}

const rows = computed(() =>
  certificates.value.map((certificate) => {
    const expiry = readCertificate(certificate.certificateDerHex)?.notAfter
    const expired = expiry ? expiry.getTime() < Date.now() : false
    const parts = [`Issued by ${commonName(certificate.issuer)}`]
    if (expiry) parts.push(`${expired ? 'expired' : 'expires'} ${formatDay(expiry.toISOString())}`)
    return {
      certificate,
      expired,
      name: commonName(certificate.subject),
      detail: parts.join(' · '),
    }
  }),
)

function sign() {
  const certificate = certificates.value.find((item) => item.index === chosen.value)
  if (certificate) emit('sign', certificate)
}

const COPY: Record<Stage, { title: string; text: string }> = {
  plug: { title: 'Use USB token', text: 'Plug in your USB signing token, then continue.' },
  checking: { title: 'Use USB token', text: 'Plug in your USB signing token, then continue.' },
  pick: {
    title: 'Choose your certificate',
    text: 'Pick the certificate on your token. Enter your PIN in the Windows prompt.',
  },
  none: { title: 'Token not found', text: 'We couldn’t detect a USB token on this computer.' },
  offline: {
    title: 'MStudio isn’t running',
    text: 'Signing with a USB token needs the MStudio app on this computer.',
  },
  failed: { title: 'Token not found', text: 'MStudio couldn’t read the certificates.' },
}
</script>

<template>
  <UiDialog :open="open" :title="COPY[stage].title" @close="emit('close')">
    <p class="text-sm text-light-500">{{ COPY[stage].text }}</p>

    <fieldset v-if="stage === 'pick'" class="flex max-h-64 flex-col gap-2 overflow-y-auto">
      <legend class="sr-only">Certificates</legend>
      <label
        v-for="row in rows"
        :key="row.certificate.index"
        class="flex cursor-pointer items-start gap-3 rounded-md border bg-dark-400 p-3"
        :class="chosen === row.certificate.index ? 'border-accent-400' : 'border-dark-600'"
      >
        <input
          v-model="chosen"
          type="radio"
          name="token-certificate"
          :value="row.certificate.index"
          :disabled="row.expired"
          class="mt-0.5 size-4 accent-accent-500"
        />
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-semi-bold">{{ row.name }}</span>
          <span class="text-xs" :class="row.expired ? 'text-alert-400' : 'text-light-500'">
            {{ row.detail }}
          </span>
        </span>
      </label>
    </fieldset>

    <div
      v-else
      class="flex flex-col items-center gap-1 rounded-md border border-dark-600 bg-dark-400 px-4 py-9 text-center"
      role="status"
    >
      <template v-if="stage === 'plug' || stage === 'checking'">
        <span class="text-sm font-semi-bold text-light-600">
          {{ stage === 'checking' ? 'Looking for your token…' : 'Waiting for token…' }}
        </span>
        <span class="text-xs text-light-500">Keep the token connected while signing</span>
      </template>
      <template v-else-if="stage === 'none'">
        <span class="text-sm font-semi-bold text-alert-500">No USB token detected</span>
        <span class="text-xs text-light-500">Plug it in and try again</span>
      </template>
      <template v-else-if="stage === 'offline'">
        <span class="text-sm font-semi-bold text-alert-500">Couldn’t reach MStudio</span>
        <span class="text-xs text-light-500">
          Open MStudio, allow local network access if your browser asks, then try again
        </span>
      </template>
      <template v-else>
        <span class="text-sm font-semi-bold text-alert-500">Couldn’t read the token</span>
        <span class="text-xs break-words text-light-500">{{ failure }}</span>
      </template>
    </div>

    <div class="flex justify-end gap-2">
      <UiButton variant="secondary" @click="emit('close')">Cancel</UiButton>
      <UiButton v-if="stage === 'pick'" :disabled="chosen === null" @click="sign">Sign</UiButton>
      <UiButton
        v-else-if="stage === 'plug' || stage === 'checking'"
        :disabled="stage === 'checking'"
        @click="detect"
      >
        Continue
      </UiButton>
      <UiButton v-else @click="detect">Retry</UiButton>
    </div>
  </UiDialog>
</template>