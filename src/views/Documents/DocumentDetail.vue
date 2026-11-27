<script setup lang="ts">
import IconPdf from '~icons/lucide/file-text'
import IconPlus from '~icons/lucide/plus'
import { useClipboard, useObjectUrl } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { documentsApi, fetchTemplateDetail, signingApi, type DocumentDetail } from '@/api'
import DocumentTitle from '@/components/documents/DocumentTitle.vue'
import SignerProgress from '@/components/documents/SignerProgress.vue'
import StatusMenu from '@/components/documents/StatusMenu.vue'
import VerifySignatureDialog from '@/components/documents/VerifySignatureDialog.vue'
import VoidDialog from '@/components/documents/VoidDialog.vue'
import UiButton from '@/components/ui/UiButton.vue'
import PreviewPanel from '@/components/wizard/PreviewPanel.vue'
import { errorMessage } from '@/composables/useTemplates'
import {
  activityOf,
  canChangeStatus,
  canSend,
  canVoid as isVoidable,
  documentMeta,
  type EDITABLE_STATUSES,
  formatAgo,
  formatDay,
  isDraft,
  isVoid,
  signedCount,
  signersOf,
  statusLabel,
} from '@/domain/documents'
import { pdfFileName, saveBlob } from '@/domain/download'
import { expiryIso, signingLink } from '@/domain/signers'
import { signerSlots } from '@/domain/signing'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const detail = ref<DocumentDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const pdfError = ref<string | null>(null)
const pdf = shallowRef<Blob | null>(null)
const pdfUrl = useObjectUrl(pdf)
const actionError = ref<string | null>(null)
const showVoid = ref(false)
const savingStatus = ref(false)
const showVerify = ref(false)
const linkNote = ref<string | null>(null)
const signable = ref(true)
const description = ref('')
const pages = ref(0)
const { copy } = useClipboard()

const signers = computed(() => (detail.value ? signersOf(detail.value) : []))
const signed = computed(() => signedCount(signers.value))
const progress = computed(() =>
  signers.value.length === 0 ? 0 : Math.round((signed.value / signers.value.length) * 100),
)
const nextIndex = computed(() => signers.value.findIndex((signer) => signer.status === 'PENDING'))
const activity = computed(() => (detail.value ? activityOf(detail.value, signers.value) : []))
const canVoid = computed(() => detail.value !== null && isVoidable(detail.value.status))
const voided = computed(() => detail.value !== null && isVoid(detail.value.status))
const meta = computed(() => (detail.value ? documentMeta(detail.value, pages.value) : ''))

async function load() {
  loading.value = true
  error.value = null
  pdfError.value = null
  try {
    const [loaded, blob] = await Promise.all([
      documentsApi.get(id.value),
      documentsApi.content(id.value).catch((e: unknown) => {
        pdfError.value = errorMessage(e)
        return null
      }),
    ])
    detail.value = loaded
    pdf.value = blob
    const template = loaded.templateId
      ? await fetchTemplateDetail(loaded.templateId).catch(() => null)
      : null
    signable.value = !template || signerSlots(template.signerFields ?? []).length > 0
    description.value = template?.description ?? ''
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

watch(
  id,
  () => {
    pages.value = 0
    description.value = ''
    void load()
  },
  { immediate: true },
)

function downloadPdf() {
  if (pdf.value && detail.value) saveBlob(pdf.value, pdfFileName(detail.value.name))
}

const nextSigner = computed(() => signers.value[nextIndex.value] ?? null)
const awaitingSignatures = computed(
  () => detail.value !== null && ['Sent', 'Partially Signed'].includes(detail.value.status),
)

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

async function changeStatus(next: (typeof EDITABLE_STATUSES)[number]) {
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
  <div class="flex h-full min-h-0 bg-dark-400 text-white">
    <PreviewPanel
      :label="detail?.name ?? 'Document'"
      :url="pdfUrl ?? null"
      :loading="loading"
      :error="error ?? pdfError"
      :fetch-download="() => documentsApi.content(id)"
      :download-name="detail?.name"
      :reset-key="id"
      viewer
      closable
      @close="router.push('/documents')"
      @page-count="pages = $event"
    />

    <aside
      class="flex w-110 shrink-0 flex-col gap-5 overflow-y-auto border-l border-dark-600 px-6 py-6"
      aria-label="Document details"
    >
      <p v-if="error" class="rounded-md bg-alert-600 px-3 py-2 text-sm" role="alert">
        Couldn't load this document: {{ error }}
      </p>

      <template v-if="detail">
        <div class="flex items-start justify-between gap-3">
          <DocumentTitle
            :document-id="detail.id"
            :name="detail.name"
            :editable="isDraft(detail.status)"
            @renamed="load"
          />
          <StatusMenu
            v-if="canChangeStatus(detail.status)"
            :status="detail.status"
            :disabled="savingStatus"
            @change="changeStatus"
          />
          <span
            v-else
            class="flex h-7 shrink-0 items-center rounded-full border border-dark-600 bg-dark-500 px-3 text-sm font-semi-bold"
          >
            {{ statusLabel(detail.status) }}
          </span>
        </div>
        <p v-if="description" class="text-sm text-light-500">{{ description }}</p>
        <p class="flex items-center gap-2 text-xs font-semi-bold text-light-500">
          <IconPdf class="size-5 shrink-0" aria-hidden="true" />
          {{ meta }}
        </p>
        <p v-if="actionError" class="text-xs text-alert-400" role="alert">{{ actionError }}</p>
        <p v-if="linkNote" class="text-xs text-light-500" role="status">{{ linkNote }}</p>

        <SignerProgress
          v-if="signers.length > 0"
          :signers="signers"
          :next-index="voided ? -1 : nextIndex"
          :voided="voided"
        />

        <hr class="border-dark-600" />

        <section class="flex flex-col gap-3" aria-label="Activity">
          <h2 class="flex items-center justify-between text-lg font-semi-bold">
            Activity <span class="text-xs font-regular text-light-500">{{ activity.length }}</span>
          </h2>
          <ul class="flex flex-col gap-3">
            <li v-for="entry in activity" :key="entry.title" class="flex items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-overlay"
                aria-hidden="true"
              >
                <IconPlus class="size-4" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="text-sm font-semi-bold">{{ entry.title }}</span>
                <span v-if="entry.detail" class="truncate text-xs text-light-500">
                  {{ entry.detail }}
                </span>
              </span>
              <span
                v-if="entry.at"
                class="shrink-0 text-xs text-light-400"
                :title="formatDay(entry.at)"
              >
                {{ formatAgo(entry.at) }}
              </span>
            </li>
          </ul>
        </section>

        <details class="group shrink-0 rounded-xl bg-dark-500 p-4 text-sm">
          <summary class="flex cursor-pointer list-none justify-between font-semi-bold">
            Raw data (JSON)
            <span class="text-light-500 group-open:rotate-90" aria-hidden="true">▸</span>
          </summary>
          <pre class="mt-2 max-h-64 overflow-auto text-xs text-light-500">{{
            JSON.stringify(detail.rawData, null, 2)
          }}</pre>
        </details>

        <div class="flex flex-wrap items-center justify-end gap-2">
          <UiButton variant="ghost" @click="showVerify = true">Verify signature</UiButton>
          <UiButton v-if="canVoid" variant="ghost" @click="showVoid = true">Void</UiButton>
          <UiButton
            v-if="awaitingSignatures && nextSigner"
            variant="secondary"
            @click="copyNextLink"
          >
            Copy link for next signer
          </UiButton>
          <UiButton
            v-if="isDraft(detail.status)"
            variant="secondary"
            @click="router.push(`/documents/${detail.id}/edit`)"
          >
            Edit
          </UiButton>
        </div>

        <div class="flex items-center justify-end gap-2">
          <UiButton variant="ghost" :disabled="!pdf" @click="downloadPdf">Download PDF</UiButton>
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
          @close="showVoid = false"
          @voided="load"
        />
        <VerifySignatureDialog
          :open="showVerify"
          :document-id="detail.id"
          @close="showVerify = false"
        />
      </template>
    </aside>
  </div>
</template>