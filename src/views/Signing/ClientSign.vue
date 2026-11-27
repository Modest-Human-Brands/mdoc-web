<script setup lang="ts">
import IconPdf from '~icons/lucide/file-text'
import { useObjectUrl } from '@vueuse/core'
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  documentsApi,
  fetchTemplateDetail,
  signingApi,
  type DocumentDetail,
  type TemplateDetail,
  type SignerField,
  type VerifySessionResponse,
} from '@/api'
import { mstudioApi, type TokenCertificate } from '@/api/mstudio'
import SignerProgress from '@/components/documents/SignerProgress.vue'
import AdoptSignatureDialog from '@/components/signing/AdoptSignatureDialog.vue'
import BrandMark from '@/components/signing/BrandMark.vue'
import SigningCard from '@/components/signing/SigningCard.vue'
import SigningStatusDialog from '@/components/signing/SigningStatusDialog.vue'
import UsbTokenDialog from '@/components/signing/UsbTokenDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import PreviewPanel from '@/components/wizard/PreviewPanel.vue'
import { errorMessage } from '@/composables/useTemplates'
import { issuerChain } from '@/domain/certificates'
import { documentMeta, formatDay, signersOf, userNameOf } from '@/domain/documents'
import { pdfFileName, saveBlob } from '@/domain/download'
import { linkExpiry, parseSigningLink } from '@/domain/signers'
import {
  fieldKind,
  fieldsOf,
  inReadingOrder,
  marksFor,
  planFields,
  signerAhead,
  signingPlaces,
  stateFromSession,
  waitingLabel,
  waitingOn,
  type FieldPlan,
  type SigningState,
} from '@/domain/signing'

const route = useRoute()
const link = computed(() => parseSigningLink(route.params))

const state = ref<SigningState>('loading')
const session = ref<VerifySessionResponse | null>(null)
const detail = ref<DocumentDetail | null>(null)
const pdf = shallowRef<Blob | null>(null)
const pdfUrl = useObjectUrl(pdf)
const plan = ref<FieldPlan>({ signatureIds: [], textFields: [] })
const myFields = ref<SignerField[]>([])
const dialogOpen = ref(false)
const busy = ref(false)
const failure = ref<string | null>(null)
const signStage = ref<'idle' | 'signing' | 'failed'>('idle')
const signStep = ref<1 | 2>(1)
let lastFields: Record<string, string> = {}
/** Set while signing with a USB token, so that "Try again" signs the same way. */
const tokenCertificate = shallowRef<TokenCertificate | null>(null)
const usbOpen = ref(false)
const signedAt = ref<Date | null>(null)

const signers = computed(() => (detail.value ? signersOf(detail.value) : []))
const me = computed(() =>
  signers.value.find((signer) => signer.email === session.value?.signerEmail),
)
const meName = computed(() => me.value?.name || session.value?.signerEmail || '')
const sender = computed(() => userNameOf(detail.value?.user) || 'Someone')
const template = shallowRef<TemplateDetail | null>(null)
const projectName = computed(() => {
  const name = detail.value?.project?.name
  return name && name !== 'Misc' ? name : ''
})
const projectLine = computed(() =>
  [projectName.value, template.value?.label].filter(Boolean).join(' · '),
)
const places = computed(() => signingPlaces(myFields.value))
const placesText = computed(() => {
  const count = places.value
  if (count === null) return 'then sign'
  return `then sign in ${count} ${count === 1 ? 'place' : 'places'}`
})
const expiresOn = computed(() => formatDay(linkExpiry(link.value?.token ?? '')?.toISOString()))
const ahead = computed(() =>
  session.value
    ? signerAhead(session.value, signers.value, detail.value?.routingType ?? null)
    : undefined,
)
const positionOf = (email: string | undefined) =>
  signers.value.findIndex((signer) => signer.email === email) + 1

const pages = ref(0)
const preview = useTemplateRef<InstanceType<typeof PreviewPanel>>('preview')
const marks = computed(() => inReadingOrder(marksFor(myFields.value, pages.value)))
const fieldIndex = ref(0)
const currentMark = computed(() => marks.value[fieldIndex.value])
const hasNextField = computed(() => fieldIndex.value < marks.value.length - 1)

function nextField() {
  fieldIndex.value++
  if (currentMark.value) preview.value?.focusMark(currentMark.value.key)
}

const waiting = computed(() => waitingOn(signers.value, session.value?.signerEmail ?? ''))
const signedOn = computed(() => {
  const at = signedAt.value ?? (me.value?.signedAt ? new Date(me.value.signedAt) : null)
  return at && !Number.isNaN(at.getTime())
    ? at.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : ''
})

async function init() {
  const parsed = link.value
  if (!parsed) {
    state.value = 'invalid'
    return
  }
  try {
    session.value = await signingApi.verifySession(parsed.id, parsed.token)
    const [loaded, blob] = await Promise.all([
      documentsApi.get(parsed.id),
      documentsApi.content(parsed.id),
    ])
    detail.value = loaded
    pdf.value = blob
    template.value = loaded.templateId
      ? await fetchTemplateDetail(loaded.templateId).catch(() => null)
      : null
    plan.value = planFields(template.value?.signerFields ?? [], session.value.order)
    myFields.value = fieldsOf(template.value?.signerFields ?? [], session.value.order)
    fieldIndex.value = 0
    state.value = stateFromSession(session.value, signersOf(loaded), loaded.routingType)
  } catch {
    state.value = 'invalid'
  }
}

watch(link, init, { immediate: true })

async function sign(fields: Record<string, string>, certificate: TokenCertificate | null) {
  const parsed = link.value
  if (!parsed || busy.value) return
  lastFields = fields
  tokenCertificate.value = certificate
  busy.value = true
  failure.value = null
  signStep.value = 1
  signStage.value = 'signing'
  dialogOpen.value = false
  usbOpen.value = false
  try {
    const prepared = await signingApi.prepare(parsed.id, {
      sessionToken: parsed.token,
      fields,
      ...(certificate
        ? {
            certificateDerHex: certificate.certificateDerHex,
            certificateChainDerHex: issuerChain(
              certificate.certificateDerHex,
              certificate.certificateChainDerHex,
            ),
          }
        : {}),
      telemetry: { userAgent: navigator.userAgent },
    })
    signStep.value = 2
    if (certificate) {
      if (!prepared.digestHex) throw new Error('The server returned nothing for the token to sign.')
      const signature = await mstudioApi.signHash(prepared.digestHex, certificate.index)
      await signingApi.signOnClient(parsed.id, prepared.sessionId, signature)
    } else {
      await signingApi.signOnServer(parsed.id, prepared.sessionId)
    }
    signedAt.value = new Date()
    detail.value = await documentsApi.get(parsed.id)
    pdf.value = await documentsApi.content(parsed.id)
    signStage.value = 'idle'
    state.value = 'signed'
  } catch (e) {
    failure.value = errorMessage(e)
    signStage.value = 'failed'
  } finally {
    busy.value = false
  }
}

function chooseToken(fields: Record<string, string>) {
  lastFields = fields
  dialogOpen.value = false
  usbOpen.value = true
}

async function downloadSigned() {
  const parsed = link.value
  if (!parsed || !detail.value) return
  try {
    saveBlob(await documentsApi.content(parsed.id), pdfFileName(`${detail.value.name}-signed`))
  } catch (e) {
    failure.value = errorMessage(e)
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-dark-400 text-white">
    <div v-if="state === 'signing' && detail" class="flex min-h-0 flex-1">
      <PreviewPanel
        ref="preview"
        :label="detail.name"
        :url="pdfUrl ?? null"
        :reset-key="detail.id"
        :fields="myFields"
        viewer
        @mark="dialogOpen = true"
        @page-count="pages = $event"
      >
        <template #rail-top>
          <BrandMark />
        </template>
        <template #overlay>
          <div
            class="flex items-center gap-4 rounded-xl border border-dark-600 bg-dark-500 py-3 pr-3 pl-5 whitespace-nowrap shadow-toolbar"
          >
            <span class="text-sm" role="status">
              {{
                currentMark
                  ? `Field ${fieldIndex + 1} of ${marks.length} · ${fieldKind(currentMark.type)}`
                  : 'Ready to sign'
              }}
            </span>
            <UiButton v-if="hasNextField" @click="nextField">Next field</UiButton>
            <UiButton v-else @click="dialogOpen = true">Sign document</UiButton>
          </div>
        </template>
      </PreviewPanel>
      <aside
        class="flex w-110 shrink-0 flex-col gap-5 overflow-y-auto border-l border-dark-600 px-6 py-6"
        aria-label="Signing details"
      >
        <p class="text-xs text-light-500">Signing as {{ meName }}</p>
        <div class="flex items-start justify-between gap-3">
          <h1 class="min-w-0 text-lg font-semi-bold break-words">{{ detail.name }}</h1>
          <span
            class="flex h-7 shrink-0 items-center rounded-full border border-dark-600 bg-dark-500 px-3 text-sm font-semi-bold"
          >
            Awaiting you
          </span>
        </div>
        <p v-if="template?.description" class="text-sm text-light-500">
          {{ template.description }}
        </p>
        <p class="flex items-center gap-2 text-xs font-semi-bold text-light-500">
          <IconPdf class="size-5 shrink-0" aria-hidden="true" />
          {{ documentMeta(detail, pages) }}
        </p>
        <SignerProgress :signers="signers" :next-index="positionOf(session?.signerEmail) - 1" />
      </aside>
    </div>

    <template v-else>
      <header class="flex items-center justify-between px-8 py-6">
        <BrandMark />
        <span v-if="meName" class="text-sm text-light-600">Signing as {{ meName }}</span>
      </header>

      <main class="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6">
        <div class="my-auto flex w-full max-w-140 flex-col py-6">
          <p v-if="state === 'loading'" class="text-center text-sm text-light-500" role="status">
            Opening your signing link…
          </p>

          <SigningCard
            v-else-if="state === 'invalid'"
            eyebrow="Link unavailable"
            title="This signing link doesn't work"
          >
            <template #text>
              For security, signing links stop working after they expire. Ask the sender to send you
              a fresh one.
            </template>
          </SigningCard>

          <SigningCard
            v-else-if="state === 'waiting' && detail"
            eyebrow="Waiting"
            title="It's not your turn yet"
            :facts="[
              {
                label: 'Currently with',
                value: `${ahead?.name || ahead?.email} · signer ${positionOf(ahead?.email)} of ${signers.length}`,
              },
              {
                label: 'Your position',
                value: `Signer ${positionOf(session?.signerEmail)} of ${signers.length}`,
              },
            ]"
          >
            <template #text>
              This document is signed in order. Open this link again once the previous signer has
              finished.
            </template>
          </SigningCard>

          <SigningCard
            v-else-if="state === 'landing' && detail"
            eyebrow="Signature requested"
            title="Your signature is needed"
            :facts="[
              projectName
                ? { label: 'Project', value: projectLine }
                : { label: 'Document', value: detail.name },
              { label: 'From', value: sender },
            ]"
          >
            <template #text>
              {{ sender }} has sent you {{ detail.name }}. Review the document, {{ placesText }}.
            </template>
            <UiButton @click="state = 'signing'">Review and sign</UiButton>
          </SigningCard>

          <SigningCard
            v-else-if="state === 'signed' && detail"
            eyebrow="Signed"
            :title="`Thank you, ${meName.split(' ')[0]}`"
            :facts="[
              { label: 'Signed on', value: signedOn },
              { label: 'Waiting on', value: waitingLabel(waiting) },
            ]"
          >
            <template #text>Your signature is recorded. You can download your copy now.</template>
            <UiButton @click="downloadSigned">Download signed copy</UiButton>
          </SigningCard>

          <SigningCard
            v-else-if="state === 'already' && detail"
            eyebrow="Already signed"
            title="You have already signed"
            :facts="[
              signedOn
                ? { label: 'Signed on', value: signedOn }
                : { label: 'Last updated', value: formatDay(detail.updatedAt) },
              {
                label: 'Status',
                value:
                  waiting === 0 ? 'Everyone has signed' : `Waiting on ${waitingLabel(waiting)}`,
              },
            ]"
          >
            <template #text>
              Your signature on this document was recorded. There is nothing more to do.
            </template>
            <UiButton @click="downloadSigned">Download signed copy</UiButton>
          </SigningCard>

          <p
            v-if="failure && signStage === 'idle'"
            class="mt-3 text-xs text-alert-400"
            role="alert"
          >
            {{ failure }}
          </p>
        </div>
      </main>

      <footer class="flex min-h-16 items-center justify-center px-6 text-xs text-light-500">
        <p v-if="state === 'landing'">
          This link is private to {{ session?.signerEmail
          }}{{ expiresOn ? ` and expires on ${expiresOn}` : '' }}.
        </p>
        <p v-else-if="state === 'waiting' || state === 'signed'">You can close this page safely.</p>
        <p v-else-if="state === 'already' && meName">Signing as {{ meName }}</p>
      </footer>
    </template>

    <AdoptSignatureDialog
      :open="dialogOpen"
      :plan="plan"
      :busy="busy"
      :error="failure"
      @close="dialogOpen = false"
      @adopt="sign($event, null)"
      @usb="chooseToken"
    />
    <UsbTokenDialog :open="usbOpen" @close="usbOpen = false" @sign="sign(lastFields, $event)" />
    <SigningStatusDialog
      :state="signStage"
      :step="signStep"
      :error="failure"
      :usb="tokenCertificate !== null"
      @close="signStage = 'idle'"
      @retry="sign(lastFields, tokenCertificate)"
    />
  </div>
</template>