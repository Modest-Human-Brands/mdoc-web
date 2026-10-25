<script setup lang="ts">
import { useClipboard, useObjectUrl } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { documentsApi, fetchTemplateDetail, signingApi, type DocumentDetail } from '@/api'
import VoidDialog from '@/components/documents/VoidDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import PreviewPanel from '@/components/wizard/PreviewPanel.vue'
import { errorMessage } from '@/composables/useTemplates'
import {
  activityOf,
  canChangeStatus,
  canSend,
  canVoid as isVoidable,
  EDITABLE_STATUSES,
  formatDay,
  signedCount,
  signerCaption,
  signersOf,
} from '@/domain/documents'
import { formatBytes } from '@/domain/format'
import { expiryIso, signingLink } from '@/domain/signers'
import { signerSlots } from '@/domain/signing'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const detail = ref<DocumentDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const pdf = shallowRef<Blob | null>(null)
const pdfUrl = useObjectUrl(pdf)
const actionError = ref<string | null>(null)
const showVoid = ref(false)
const savingStatus = ref(false)
const verifyResult = ref<string | null>(null)
const linkNote = ref<string | null>(null)
const signable = ref(true)
const { copy } = useClipboard()

const signers = computed(() => (detail.value ? signersOf(detail.value) : []))
const signed = computed(() => signedCount(signers.value))
const progress = computed(() =>
  signers.value.length === 0 ? 0 : Math.round((signed.value / signers.value.length) * 100),
)
const nextIndex = computed(() => signers.value.findIndex((signer) => signer.status === 'PENDING'))
const activity = computed(() => (detail.value ? activityOf(detail.value, signers.value) : []))
const canVoid = computed(() => detail.value !== null && isVoidable(detail.value.status))

async function load() {
  loading.value = true
  error.value = null
  try {
    const [loaded, blob] = await Promise.all([
      documentsApi.get(id.value),
      documentsApi.content(id.value),
    ])
    detail.value = loaded
    pdf.value = blob
    const template = loaded.templateId
      ? await fetchTemplateDetail(loaded.templateId).catch(() => null)
      : null
    signable.value = !template || signerSlots(template.signerFields ?? []).length > 0
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

watch(id, load, { immediate: true })

const nextSigner = computed(() => signers.value[nextIndex.value] ?? null)
const awaitingSignatures = computed(
  () => detail.value !== null && ['Sent', 'Partially Signed'].includes(detail.value.status),
)

async function verifySignature() {
  if (!pdf.value) return
  actionError.value = null
  verifyResult.value = null
  try {
    const result = await signingApi.verifySignature(id.value, pdf.value)
    verifyResult.value = `${result.signer}: ${result.message}`
  } catch (e) {
    actionError.value = errorMessage(e)
  }
}

async function copyNextLink() {
  const signer = nextSigner.value
  if (!signer) return
  actionError.value = null
  linkNote.value = null
  try {
    const session = await signingApi.createSession(id.value, {
      signerEmail: signer.email,
      expiresIn: expiryIso(7),
    })
    await copy(signingLink(window.location.origin, id.value, session.sessionToken))
    linkNote.value = `Link for ${signer.name || signer.email} copied. It works for 7 days.`
  } catch (e) {
    actionError.value = errorMessage(e)
  }
}

async function changeStatus(event: Event) {
  const next = (event.target as HTMLSelectElement).value as (typeof EDITABLE_STATUSES)[number]
  savingStatus.value = true
  actionError.value = null
  try {
    await documentsApi.update(id.value, { status: next })
    await load()
  } catch (e) {
    actionError.value = errorMessage(e)
  } finally {
    savingStatus.value = false
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 gap-3 bg-dark-400 p-3 text-white">
    <PreviewPanel
      :label="detail?.name ?? 'Document'"
      :url="pdfUrl ?? null"
      :loading="loading"
      :error="error"
      :fetch-download="() => documentsApi.content(id)"
      :download-name="detail?.name"
      :reset-key="id"
    />

    <aside
      class="flex w-105 shrink-0 flex-col gap-5 overflow-y-auto px-4 py-4"
      aria-label="Document details"
    >
      <button
        type="button"
        class="self-start text-sm font-semi-bold text-light-400 hover:text-white"
        @click="router.push('/documents')"
      >
        ← Documents
      </button>

      <p v-if="error" class="rounded-md bg-alert-600 px-3 py-2 text-sm" role="alert">
        Couldn't load this document: {{ error }}
      </p>

      <template v-if="detail">
        <div class="flex items-start justify-between gap-3">
          <h1 class="text-lg font-bold">{{ detail.name }}</h1>
          <select
            v-if="canChangeStatus(detail.status)"
            :value="detail.status"
            :disabled="savingStatus"
            aria-label="Status"
            class="rounded-md border border-dark-600 bg-dark-500 px-2 py-1 text-xs font-semi-bold"
            @change="changeStatus"
          >
            <option v-for="status in EDITABLE_STATUSES" :key="status" :value="status">
              {{ status }}
            </option>
          </select>
          <span v-else class="rounded-md bg-dark-500 px-2 py-1 text-xs font-semi-bold">
            {{ detail.status }}
          </span>
        </div>
        <p class="text-xs text-light-400">
          PDF · {{ formatDay(detail.createdAt) }} · {{ formatBytes(detail.sizeBytes ?? -1) }}
        </p>
        <p v-if="actionError" class="text-xs text-alert-400" role="alert">{{ actionError }}</p>
        <p v-if="verifyResult" class="text-xs text-success-400" role="status">{{ verifyResult }}</p>
        <p v-if="linkNote" class="text-xs text-light-400" role="status">{{ linkNote }}</p>

        <section v-if="signers.length > 0" class="flex flex-col gap-3" aria-label="Signers">
          <div class="flex items-center justify-between text-xs text-light-400">
            <span>{{ signed }} of {{ signers.length }} signed</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="h-1 rounded-full bg-dark-600">
            <div class="h-full rounded-full bg-accent-500" :style="{ width: `${progress}%` }" />
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
                  {{ signerCaption(signer, signers[index - 1], index === nextIndex) }}
                </span>
              </span>
              <span class="rounded-md bg-dark-500 px-2 py-1 text-xs font-semi-bold">
                {{
                  signer.status === 'SIGNED' ? 'Signed' : index === nextIndex ? 'Next' : 'Waiting'
                }}
              </span>
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-2" aria-label="Activity">
          <h2 class="flex items-center justify-between text-sm font-bold">
            Activity <span class="text-xs font-regular text-light-400">{{ activity.length }}</span>
          </h2>
          <ul class="flex flex-col gap-2">
            <li
              v-for="entry in activity"
              :key="entry.title + entry.at"
              class="flex flex-col text-sm"
            >
              <span>{{ entry.title }}</span>
              <span class="text-xs text-light-400"
                >{{ entry.detail }} · {{ formatDay(entry.at) }}</span
              >
            </li>
          </ul>
        </section>

        <details class="rounded-md border border-dark-600 bg-dark-500 px-3 py-2 text-sm">
          <summary class="cursor-pointer font-semi-bold">Raw data (JSON)</summary>
          <pre class="mt-2 max-h-64 overflow-auto text-xs text-light-500">{{
            JSON.stringify(detail.rawData, null, 2)
          }}</pre>
        </details>

        <div class="mt-auto flex flex-wrap items-center justify-end gap-2">
          <UiButton variant="ghost" :disabled="!pdf" @click="verifySignature"
            >Verify signature</UiButton
          >
          <UiButton
            v-if="awaitingSignatures && nextSigner"
            variant="secondary"
            @click="copyNextLink"
          >
            Copy link for next signer
          </UiButton>
          <UiButton variant="ghost" :disabled="!canVoid" @click="showVoid = true">Void</UiButton>
          <UiButton
            v-if="canSend(detail.status) && signable"
            @click="router.push(`/documents/${detail.id}/send`)"
          >
            Send for signature
          </UiButton>
        </div>

        <VoidDialog
          :open="showVoid"
          :document-id="detail.id"
          :name="detail.name"
          @close="showVoid = false"
          @voided="load"
        />
      </template>
    </aside>
  </div>
</template>