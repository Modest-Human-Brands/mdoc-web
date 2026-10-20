<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  documentsApi,
  fetchTemplateDetail,
  signingApi,
  type DocumentDetail,
  type VerifySessionResponse,
} from '@/api'
import AdoptSignatureDialog from '@/components/signing/AdoptSignatureDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import PreviewPanel from '@/components/wizard/PreviewPanel.vue'
import { errorMessage } from '@/composables/useTemplates'
import { formatDay, signedCount, signerCaption, signersOf } from '@/domain/documents'
import { pdfFileName, saveBlob } from '@/domain/download'
import { parseSigningLink } from '@/domain/signers'
import {
  planFields,
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
const dialogOpen = ref(false)
const busy = ref(false)
const failure = ref<string | null>(null)
const signedAt = ref<Date | null>(null)

const signers = computed(() => (detail.value ? signersOf(detail.value) : []))
const me = computed(() =>
  signers.value.find((signer) => signer.email === session.value?.signerEmail),
)
const meName = computed(() => me.value?.name || session.value?.signerEmail || '')
const sender = computed(() => {
  const name = detail.value?.project?.name
  return name && name !== 'Misc' ? name : 'Someone'
})
const waiting = computed(() => waitingOn(signers.value, session.value?.signerEmail ?? ''))
const signedOn = computed(() =>
  signedAt.value
    ? signedAt.value.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : '',
)

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
    const template = loaded.templateId
      ? await fetchTemplateDetail(loaded.templateId).catch(() => null)
      : null
    plan.value = planFields(template?.signerFields ?? [], session.value.order)
    state.value = stateFromSession(session.value.status)
  } catch {
    state.value = 'invalid'
  }
}

watch(link, init, { immediate: true })

async function adopt(fields: Record<string, string>) {
  const parsed = link.value
  if (!parsed) return
  busy.value = true
  failure.value = null
  try {
    const prepared = await signingApi.prepare(parsed.id, {
      sessionToken: parsed.token,
      fields,
      telemetry: { userAgent: navigator.userAgent },
    })
    await signingApi.signOnServer(parsed.id, prepared.sessionId)
    signedAt.value = new Date()
    dialogOpen.value = false
    detail.value = await documentsApi.get(parsed.id)
    pdf.value = await documentsApi.content(parsed.id)
    state.value = 'signed'
  } catch (e) {
    failure.value = errorMessage(e)
  } finally {
    busy.value = false
  }
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
    <header class="flex items-center justify-between px-6 py-4">
      <div class="flex items-center gap-2">
        <span
          class="flex size-6 items-center justify-center rounded-sm bg-white text-xs font-bold text-dark-400"
          aria-hidden="true"
        >
          M
        </span>
        <span class="text-base font-bold">MDoc</span>
      </div>
      <span v-if="meName" class="text-sm text-light-400">Signing as {{ meName }}</span>
    </header>

    <main class="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
      <p v-if="state === 'loading'" class="text-sm text-light-400" role="status">
        Opening your signing link…
      </p>

      <section
        v-else-if="state === 'invalid'"
        class="flex w-full max-w-140 flex-col gap-4 rounded-2xl border border-dark-600 bg-dark-500 p-8"
      >
        <p class="text-xs tracking-widest text-light-400 uppercase">Link unavailable</p>
        <h1 class="text-2xl font-bold">This signing link doesn't work</h1>
        <p class="text-light-500">
          For security, signing links stop working after they expire. Ask the sender to send you a
          fresh one.
        </p>
      </section>

      <section
        v-else-if="state === 'landing' && detail"
        class="flex w-full max-w-140 flex-col gap-4 rounded-2xl border border-dark-600 bg-dark-500 p-8"
      >
        <p class="text-xs tracking-widest text-light-400 uppercase">Signature requested</p>
        <h1 class="text-2xl font-bold">Your signature is needed</h1>
        <p class="text-light-500">
          {{ sender }} has sent you {{ detail.name }}. Review the document, then sign.
        </p>
        <dl class="flex flex-col gap-3 rounded-lg bg-dark-400 p-4 text-sm">
          <div>
            <dt class="text-xs text-light-400">Document</dt>
            <dd>{{ detail.name }}</dd>
          </div>
          <div>
            <dt class="text-xs text-light-400">From</dt>
            <dd>{{ sender }}</dd>
          </div>
        </dl>
        <UiButton @click="state = 'signing'">Review and sign</UiButton>
        <p class="text-center text-xs text-light-400">
          This link is private to {{ session?.signerEmail }}.
        </p>
      </section>

      <div v-else-if="state === 'signing' && detail" class="flex size-full min-h-0 gap-3">
        <PreviewPanel :label="detail.name" :url="pdfUrl ?? null" :reset-key="detail.id" />
        <aside
          class="flex w-96 shrink-0 flex-col gap-5 overflow-y-auto px-2"
          aria-label="Signing details"
        >
          <div class="flex items-start justify-between gap-3">
            <h1 class="text-lg font-bold">{{ detail.name }}</h1>
            <span class="rounded-md bg-dark-500 px-2 py-1 text-xs font-semi-bold"
              >Awaiting you</span
            >
          </div>
          <div class="flex flex-col gap-2">
            <div class="flex justify-between text-xs text-light-400">
              <span>{{ signedCount(signers) }} of {{ signers.length }} signed</span>
            </div>
            <ul class="flex flex-col gap-2">
              <li
                v-for="(signer, index) in signers"
                :key="signer.email"
                class="flex items-center justify-between gap-3 text-sm"
              >
                <span class="flex min-w-0 flex-col">
                  <span class="truncate font-semi-bold">{{ signer.name || signer.email }}</span>
                  <span class="truncate text-xs text-light-400">
                    {{
                      signerCaption(
                        signer,
                        signers[index - 1],
                        signer.email === session?.signerEmail,
                      )
                    }}
                  </span>
                </span>
              </li>
            </ul>
          </div>
          <div
            class="mt-auto flex items-center justify-between gap-3 rounded-xl border border-dark-600 bg-dark-500 p-3"
          >
            <span class="text-sm text-light-500">Ready to sign</span>
            <UiButton @click="dialogOpen = true">Sign document</UiButton>
          </div>
        </aside>
      </div>

      <section
        v-else-if="(state === 'signed' || state === 'already') && detail"
        class="flex w-full max-w-140 flex-col gap-4 rounded-2xl border border-dark-600 bg-dark-500 p-8"
      >
        <p class="text-xs tracking-widest text-light-400 uppercase">
          {{ state === 'signed' ? 'Signed' : 'Already signed' }}
        </p>
        <h1 class="text-2xl font-bold">
          {{
            state === 'signed' ? `Thank you, ${meName.split(' ')[0]}` : 'You have already signed'
          }}
        </h1>
        <p class="text-light-500">
          {{
            state === 'signed'
              ? 'Your signature is recorded. Everyone receives the fully signed copy once the last signer is done.'
              : 'Your signature on this document was recorded. There is nothing more to do.'
          }}
        </p>
        <dl class="flex flex-col gap-3 rounded-lg bg-dark-400 p-4 text-sm">
          <div v-if="signedOn">
            <dt class="text-xs text-light-400">Signed on</dt>
            <dd>{{ signedOn }}</dd>
          </div>
          <div>
            <dt class="text-xs text-light-400">Waiting on</dt>
            <dd>{{ waitingLabel(waiting) }}</dd>
          </div>
          <div v-if="detail.updatedAt">
            <dt class="text-xs text-light-400">Last updated</dt>
            <dd>{{ formatDay(detail.updatedAt) }}</dd>
          </div>
        </dl>
        <UiButton @click="downloadSigned">Download signed copy</UiButton>
        <p v-if="failure" class="text-xs text-alert-400" role="alert">{{ failure }}</p>
      </section>
    </main>

    <AdoptSignatureDialog
      :open="dialogOpen"
      :plan="plan"
      :busy="busy"
      :error="failure"
      @close="dialogOpen = false"
      @adopt="adopt"
    />
  </div>
</template>