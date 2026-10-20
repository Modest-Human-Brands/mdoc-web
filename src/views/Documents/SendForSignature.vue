<script setup lang="ts">
import { useClipboard, useObjectUrl } from '@vueuse/core'
import { NotArrayField, NotField, NotForm, useNotForm } from 'notform'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { documentsApi, signingApi, type DocumentDetail } from '@/api'
import UiAddButton from '@/components/ui/UiAddButton.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTextField from '@/components/ui/UiTextField.vue'
import PreviewPanel from '@/components/wizard/PreviewPanel.vue'
import { errorMessage } from '@/composables/useTemplates'
import { formatBytes } from '@/domain/format'
import { loadOrganization } from '@/domain/organization'
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

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const detail = ref<DocumentDetail | null>(null)
const pdf = shallowRef<Blob | null>(null)
const pdfUrl = useObjectUrl(pdf)
const loadError = ref<string | null>(null)
const sendError = ref<string | null>(null)
const sending = ref(false)
const link = ref<string | null>(null)

const form = useNotForm({
  schema: signersFormSchema,
  initialValues: { signers: [emptySigner()], expiresInDays: '7' },
})

const { copy, copied } = useClipboard({ copiedDuring: 2000 })

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

function initialSigners(loaded: DocumentDetail): SignerRow[] {
  const rows: SignerRow[] = []
  const recipient = recipientOf(loaded.rawData)
  if (recipient)
    rows.push({ name: recipient.name ?? '', email: recipient.email ?? '', role: 'Client' })
  const organisation = loadOrganization()
  if (organisation.name.trim() !== '' && organisation.contactEmail.trim() !== '') {
    rows.push({ name: organisation.name, email: organisation.contactEmail, role: 'Organisation' })
  }
  return rows.length > 0 ? rows : [emptySigner()]
}

async function load() {
  loadError.value = null
  try {
    const [loaded, blob] = await Promise.all([
      documentsApi.get(id.value),
      documentsApi.content(id.value),
    ])
    detail.value = loaded
    pdf.value = blob
    form.reset({ signers: initialSigners(loaded), expiresInDays: '7' })
  } catch (e) {
    loadError.value = errorMessage(e)
  }
}

watch(id, load, { immediate: true })

async function send() {
  sendError.value = null
  const checked = await form.validate()
  if (checked.issues) return
  sending.value = true
  try {
    await signingApi.sendEnvelope(id.value, envelopeFrom(form.values.signers))
    const first = form.values.signers[0]
    if (!first) return
    const session = await signingApi.createSession(id.value, {
      signerEmail: first.email.trim(),
      expiresIn: expiryIso(Number(form.values.expiresInDays)),
    })
    link.value = signingLink(window.location.origin, id.value, session.sessionToken)
  } catch (e) {
    sendError.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 gap-3 bg-dark-400 p-3 text-white">
    <PreviewPanel
      :label="detail?.name ?? 'Document'"
      :url="pdfUrl ?? null"
      :loading="detail === null && loadError === null"
      :error="loadError"
      :reset-key="id"
    />

    <aside
      class="flex w-105 shrink-0 flex-col gap-5 overflow-y-auto px-4 py-4"
      aria-label="Send for signature"
    >
      <div class="flex flex-col gap-1">
        <h1 class="text-xl font-bold tracking-tight">Send for signature</h1>
        <p class="text-sm text-light-400">
          Choose who signs and in what order. Each signer gets a private link; later signers unlock
          after earlier ones sign.
        </p>
      </div>

      <template v-if="link">
        <div class="flex flex-col gap-3 rounded-lg border border-dark-600 bg-dark-500 p-4">
          <p class="text-sm font-semi-bold">Sent. Share the first signing link.</p>
          <div class="flex items-center gap-2">
            <input
              :value="link"
              readonly
              aria-label="Signing link"
              class="h-9 min-w-0 flex-1 rounded-md border border-dark-600 bg-dark-400 px-3 text-xs text-light-500"
            />
            <UiButton variant="secondary" @click="copy(link)">{{
              copied ? 'Copied' : 'Copy link'
            }}</UiButton>
          </div>
          <p class="text-xs text-light-400">
            Links for the other signers are created when it is their turn.
          </p>
        </div>
        <div class="mt-auto flex justify-end">
          <UiButton @click="router.push(`/documents/${id}`)">Back to document</UiButton>
        </div>
      </template>

      <template v-else>
        <div
          v-if="detail"
          class="flex items-center gap-3 rounded-lg border border-dark-600 bg-dark-500 p-3"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-md bg-dark-600 text-2xs font-bold tracking-wide text-light-600"
            aria-hidden="true"
          >
            PDF
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-sm font-semi-bold">{{ detail.name }}.pdf</span>
            <span class="text-xs text-light-400"
              >A4 · {{ formatBytes(detail.sizeBytes ?? -1) }}</span
            >
          </span>
        </div>

        <NotForm :form="form" class="flex flex-col gap-4" @submit.prevent="send">
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
                    v-if="items.length > 1"
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
                  <UiTextField v-model="form.values.signers[item.index]!.role" label="Role" />
                </div>
              </div>
              <p v-if="listErrors[0]" class="text-xs text-alert-400" role="alert">
                {{ listErrors[0].message }}
              </p>
              <UiAddButton @click="append(emptySigner())">Add signer</UiAddButton>
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

        <p v-if="sendError" class="rounded-md bg-alert-600 px-3 py-2 text-sm" role="alert">
          Couldn't send: {{ sendError }}
        </p>

        <div class="mt-auto flex items-center justify-end gap-2">
          <UiButton variant="ghost" @click="router.push(`/documents/${id}`)">Back</UiButton>
          <UiButton :disabled="sending || detail === null" @click="send">
            {{ sending ? 'Sending…' : 'Send for signature' }}
          </UiButton>
        </div>
      </template>
    </aside>
  </div>
</template>