<script setup lang="ts">
import IconPdf from '~icons/lucide/file-text'
import { useClipboard, useObjectUrl } from '@vueuse/core'
import { NotArrayField, NotField, NotForm, useNotForm } from 'notform'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError, documentsApi, fetchTemplateDetail, signingApi, type DocumentDetail } from '@/api'
import UiAddButton from '@/components/ui/UiAddButton.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import PreviewPanel from '@/components/wizard/PreviewPanel.vue'
import { errorMessage } from '@/composables/useTemplates'
import { formatDay, initialOf } from '@/domain/documents'
import { formatBytes } from '@/domain/format'
import {
  emptySigner,
  envelopeFrom,
  EXPIRY_OPTIONS,
  expiryIso,
  ordinalLabel,
  signersFormSchema,
  signingLink,
  type SignerRow,
} from '@/domain/signers'
import { signerSlots, type SignerSlot } from '@/domain/signing'
import { useWizardStore } from '@/stores/wizard'

const route = useRoute()
const wizard = useWizardStore()
const router = useRouter()
const id = computed(() => String(route.params.id))

const detail = ref<DocumentDetail | null>(null)
const pdf = shallowRef<Blob | null>(null)
const pdfUrl = useObjectUrl(pdf)
const loadError = ref<string | null>(null)
const sendError = ref<string | null>(null)
const sendIssues = ref<string[]>([])
const sending = ref(false)
/** Set once the envelope is sent and the first signer's link exists. */
const sent = ref<{ link: string; signers: SignerRow[]; expiresAt: string } | null>(null)
const sentTo = computed(() => sent.value?.signers[0])
const slots = ref<SignerSlot[] | null>(null)
const fixed = computed(() => slots.value !== null && slots.value.length > 0)
const unsignable = computed(() => slots.value !== null && slots.value.length === 0)

const form = useNotForm({
  schema: signersFormSchema,
  initialValues: { signers: [emptySigner()], expiresInDays: '7' },
})

const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })

function recipientOf(raw: Record<string, unknown> | null): Partial<SignerRow> | null {
  const sources = [raw, raw?.data, raw?.variables]
  for (const source of sources) {
    const recipient = (source as { recipient?: Record<string, unknown> } | null)?.recipient
    if (recipient && typeof recipient === 'object') {
      return {
        name: typeof recipient.name === 'string' ? recipient.name : '',
        email: typeof recipient.email === 'string' ? recipient.email : '',
      }
    }
  }
  return null
}

function initialSigners(loaded: DocumentDetail, slotList: SignerSlot[] | null): SignerRow[] {
  const recipient = recipientOf(loaded.rawData)
  const organisation = wizard.organization
  const hasOrganisation = organisation.name.trim() !== '' && organisation.contactEmail.trim() !== ''
  if (slotList === null) {
    const rows: SignerRow[] = []
    if (recipient)
      rows.push({ name: recipient.name ?? '', email: recipient.email ?? '', role: 'Client' })
    if (hasOrganisation)
      rows.push({ name: organisation.name, email: organisation.contactEmail, role: 'Organisation' })
    return rows.length > 0 ? rows : [emptySigner()]
  }
  return slotList.map((slot, index) => {
    if (index === 0 && recipient)
      return { name: recipient.name ?? '', email: recipient.email ?? '', role: slot.role }
    if (index === slotList.length - 1 && slotList.length > 1 && hasOrganisation)
      return { name: organisation.name, email: organisation.contactEmail, role: slot.role }
    return { name: '', email: '', role: slot.role }
  })
}

async function load() {
  loadError.value = null
  try {
    const [loaded, blob] = await Promise.all([
      documentsApi.get(id.value),
      documentsApi.content(id.value),
      wizard.ensureOrganization(),
    ])
    detail.value = loaded
    pdf.value = blob
    const template = loaded.templateId
      ? await fetchTemplateDetail(loaded.templateId).catch(() => null)
      : null
    slots.value = template ? signerSlots(template.signerFields ?? []) : null
    form.reset({ signers: initialSigners(loaded, slots.value), expiresInDays: '7' })
  } catch (e) {
    loadError.value = errorMessage(e)
  }
}

watch(
  id,
  () => {
    sent.value = null
    void load()
  },
  { immediate: true },
)

async function send() {
  sendError.value = null
  sendIssues.value = []
  const checked = await form.validate()
  if (checked.issues) return
  sending.value = true
  try {
    await signingApi.sendEnvelope(id.value, envelopeFrom(form.values.signers))
    const signers = form.values.signers.map((signer) => ({ ...signer }))
    const first = signers[0]
    if (!first) return
    const expiresAt = expiryIso(Number(form.values.expiresInDays))
    const session = await signingApi.createSession(id.value, {
      signerEmail: first.email.trim(),
      expiresIn: expiresAt,
    })
    sent.value = {
      link: signingLink(window.location.origin, id.value, session.sessionToken),
      signers,
      expiresAt: session.expiresAt ?? expiresAt,
    }
  } catch (e) {
    sendError.value = errorMessage(e)
    sendIssues.value = e instanceof ApiError ? e.fields.map((field) => field.message) : []
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 bg-dark-400 text-white">
    <PreviewPanel
      :label="detail?.name ?? 'Document'"
      :url="pdfUrl ?? null"
      :loading="detail === null && loadError === null"
      :error="loadError"
      :reset-key="id"
      viewer
      closable
      @close="router.push(`/documents/${id}`)"
    />

    <aside
      class="flex w-105 shrink-0 flex-col gap-5 overflow-y-auto border-l border-dark-600 px-6 py-6"
      aria-label="Send for signature"
    >
      <div class="flex flex-col gap-1">
        <h1 class="text-xl font-semi-bold tracking-tight">
          {{ sent ? 'Sent for signature' : 'Send for signature' }}
        </h1>
        <p class="text-sm text-light-500">
          {{
            sentTo
              ? `Share the private link with ${sentTo.name.trim()} to collect the first signature.`
              : 'Choose who signs and in what order. Each signer gets a private link; later signers unlock after earlier ones sign.'
          }}
        </p>
      </div>

      <div
        v-if="detail"
        class="flex shrink-0 items-center gap-3 rounded-xl border border-dark-600 bg-dark-500 p-3"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-md bg-overlay"
          aria-hidden="true"
        >
          <IconPdf class="size-5" />
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-semi-bold">{{ detail.name }}.pdf</span>
          <span class="text-xs text-light-500">A4 · {{ formatBytes(detail.sizeBytes ?? -1) }}</span>
        </span>
      </div>

      <template v-if="sent && sentTo">
        <ul class="flex flex-col gap-3" aria-label="Signers">
          <li
            v-for="(signer, index) in sent.signers"
            :key="signer.email"
            class="flex items-center gap-3"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full bg-overlay text-xs font-semi-bold"
              aria-hidden="true"
            >
              {{ initialOf(signer.name) }}
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-semi-bold">{{ signer.name }}</span>
              <span class="truncate text-xs text-light-500">
                {{ [signer.email, signer.role].filter(Boolean).join(' · ') }}
              </span>
            </span>
            <span class="shrink-0 rounded-full bg-overlay px-3 py-1 text-xs font-semi-bold">
              {{ index === 0 ? 'Link ready' : 'Waiting' }}
            </span>
          </li>
        </ul>
        <p
          class="rounded-md border border-success-600 bg-dark-500 px-4 py-3 text-xs break-words"
          role="status"
        >
          Link for {{ sentTo.email.trim() }} · expires {{ formatDay(sent.expiresAt) }}
        </p>
        <div class="flex flex-col gap-2">
          <p class="text-xs text-light-500">Signing link · {{ sentTo.name.trim() }}</p>
          <div
            class="flex items-center gap-2 rounded-md border border-dark-600 bg-dark-500 py-1 pr-1 pl-3"
          >
            <input
              :value="sent.link"
              readonly
              aria-label="Signing link"
              class="min-w-0 flex-1 bg-transparent text-sm text-light-600 outline-none"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <UiButton variant="secondary" @click="copy(sent.link)">
              {{ copied ? 'Copied' : 'Copy link' }}
            </UiButton>
          </div>
          <p class="text-xs text-light-500">
            Share this link only with {{ sentTo.name.trim() }}.{{
              sent.signers.length > 1
                ? ' Links for the other signers are generated when it’s their turn.'
                : ''
            }}
          </p>
        </div>
        <div class="mt-auto flex justify-end gap-2">
          <UiButton variant="ghost" @click="router.push(`/documents/${id}`)">
            View document
          </UiButton>
          <UiButton @click="router.push('/documents')">Done</UiButton>
        </div>
      </template>

      <template v-else>
        <p
          v-if="unsignable"
          class="rounded-lg border border-dark-600 bg-dark-500 p-4 text-sm text-light-500"
        >
          This template has no signature fields, so it can't be sent for signature.
        </p>
        <p v-else-if="fixed" class="text-xs text-light-400">
          This template needs {{ slots!.length }} {{ slots!.length === 1 ? 'signer' : 'signers' }}.
        </p>

        <NotForm v-if="!unsignable" :form="form" class="flex flex-col gap-4" @submit.prevent="send">
          <NotArrayField v-slot="{ items, append, remove, errors: listErrors }" path="signers">
            <div class="flex flex-col gap-3">
              <div
                v-for="item in items"
                :key="item.key"
                class="flex flex-col gap-2 rounded-lg border border-dark-600 p-3"
              >
                <div class="flex items-center justify-between text-xs">
                  <span class="rounded-full bg-dark-600 px-2 py-0.5 font-semi-bold">
                    {{ ordinalLabel(item.index, items.length) }}
                  </span>
                  <button
                    v-if="!fixed && items.length > 1"
                    type="button"
                    class="font-semi-bold text-light-400 hover:text-white"
                    @click="remove(item.index)"
                  >
                    Remove
                  </button>
                </div>
                <NotField v-slot="{ errors, events }" :path="`signers.${item.index}.name`">
                  <UiTextField
                    v-model="form.values.signers[item.index]!.name"
                    label="Name"
                    :error="errors[0]?.message"
                    @focusout="events.onBlur"
                    @input="events.onInput"
                  />
                </NotField>
                <div class="grid grid-cols-2 gap-2">
                  <NotField v-slot="{ errors, events }" :path="`signers.${item.index}.email`">
                    <UiTextField
                      v-model="form.values.signers[item.index]!.email"
                      label="Email"
                      type="email"
                      :error="errors[0]?.message"
                      @focusout="events.onBlur"
                      @input="events.onInput"
                    />
                  </NotField>
                  <UiTextField
                    v-model="form.values.signers[item.index]!.role"
                    label="Role"
                    :readonly="fixed"
                  />
                </div>
              </div>
              <p v-if="listErrors[0]" class="text-xs text-alert-400" role="alert">
                {{ listErrors[0].message }}
              </p>
              <UiAddButton v-if="!fixed" @click="append(emptySigner())">Add signer</UiAddButton>
            </div>
          </NotArrayField>

          <label class="flex flex-col gap-1.5 text-sm font-semi-bold text-light-600">
            Link expires after
            <select
              v-model="form.values.expiresInDays"
              class="h-9.5 rounded-md border border-dark-600 bg-dark-500 px-3 text-sm text-white outline-none focus:border-accent-400"
            >
              <option
                v-for="option in EXPIRY_OPTIONS"
                :key="option.days"
                :value="String(option.days)"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </NotForm>

        <div v-if="sendError" class="rounded-md bg-alert-600 px-3 py-2 text-sm" role="alert">
          <p>Couldn't send.</p>
          <ul v-if="sendIssues.length > 0" class="mt-1 list-disc pl-4">
            <li v-for="issue in sendIssues" :key="issue">{{ issue }}</li>
          </ul>
          <p v-else>{{ sendError }}</p>
        </div>

        <div class="mt-auto flex items-center justify-end gap-2">
          <UiButton variant="ghost" @click="router.push(`/documents/${id}`)">Back</UiButton>
          <UiButton :disabled="sending || detail === null || unsignable" @click="send">
            {{ sending ? 'Sending…' : 'Send for signature' }}
          </UiButton>
        </div>
      </template>
    </aside>
  </div>
</template>