import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import {
  ApiError,
  templatesApi,
  type CreateDocumentResponse,
  type FieldError,
  type TemplateDetail,
} from '@/api'
import {
  computeTotals,
  formatDate,
  formatInr,
  hasBilling,
  templateDefaults,
} from '@/domain/invoice'
import { loadOrganization, saveOrganization, type OrganizationProfile } from '@/domain/organization'
import {
  emptyValue,
  missingRequired,
  previewPayload,
  setPath,
  stripExcluded,
  textAt,
  toPayload,
  withDefaults,
  type Problem,
  type Values,
} from '@/domain/schema'

export const STEPS = [
  { name: 'template', label: 'Template', path: '/new/template' },
  { name: 'brand', label: 'Brand', path: '/new/brand' },
  { name: 'details', label: 'Details', path: '/new/details' },
  { name: 'send', label: 'Send', path: '/new/send' },
] as const

export interface EmailDraft {
  to: string
  cc: string
  subject: string
  message: string
}

/** Notion ids the API requires on creation; typed once and remembered on this device. */
export interface OwnerIds {
  userId: string
  contactId: string
  projectId: string
}

const DRAFT_KEY = 'mdoc.draft'
const IDS_KEY = 'mdoc.ids'
const SEQ_KEY = 'mdoc.invoiceSeq'

interface Draft {
  templateId: string | null
  values: Values
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Best-effort persistence.
  }
}

function readSeq(): number {
  const value = Number.parseInt(localStorage.getItem(SEQ_KEY) ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : 1
}

export const useWizardStore = defineStore('wizard', () => {
  const saved = read<Partial<Draft>>(DRAFT_KEY)

  const templateId = ref<string | null>(saved?.templateId ?? null)
  const template = ref<TemplateDetail | null>(null)
  /** Raw form state (strings while typing) shaped like the template's schema. */
  const values = ref<Values>(saved?.values ?? {})
  const organization = ref<OrganizationProfile>(loadOrganization())
  const organizationSaved = ref(true)
  const ids = ref<OwnerIds>({
    userId: '',
    contactId: '',
    projectId: '',
    ...read<Partial<OwnerIds>>(IDS_KEY),
  })
  const document = ref<CreateDocumentResponse | null>(null)
  const serverErrors = ref<FieldError[]>([])
  const email = ref<EmailDraft>({ to: '', cc: '', subject: '', message: '' })

  const schema = computed(() => (template.value ? stripExcluded(template.value.schema) : null))
  const totals = computed(() => computeTotals(values.value))
  const showAmountDue = computed(() => hasBilling(values.value))

  /** Variables for the preview: user input over placeholders, plus the branding preset id. */
  const previewVariables = computed<Values>(() => ({
    ...(schema.value ? previewPayload(schema.value, values.value) : {}),
    organizationId: organization.value.id,
  }))

  /** Problems that block creation: schema `required` plus the owner ids. */
  const problems = computed<Problem[]>(() => {
    const list = schema.value ? missingRequired(schema.value, values.value) : []
    if (!ids.value.userId.trim()) list.push({ path: 'ids.userId', message: 'User ID is required' })
    if (!ids.value.contactId.trim()) {
      list.push({ path: 'ids.contactId', message: 'Contact ID is required' })
    }
    return list
  })

  /** Path → message, from client checks only shown after a failed attempt, plus server errors. */
  const fieldErrors = computed<Record<string, string>>(() => {
    const result: Record<string, string> = {}
    for (const error of serverErrors.value) result[error.field] = error.message
    return result
  })

  /** Called by the template screen once the chosen template's schema is known. */
  function applyTemplate(detail: TemplateDetail) {
    template.value = detail
    const blank = emptyValue(stripExcluded(detail.schema)) as Values
    const defaults = templateDefaults(
      detail.id,
      organization.value.name || organization.value.id,
      readSeq(),
    )
    values.value = withDefaults(withDefaults(values.value, defaults), blank) as Values
  }

  function selectTemplate(id: string | null) {
    if (templateId.value === id) return
    templateId.value = id
    template.value = null
    values.value = {}
    document.value = null
    serverErrors.value = []
  }

  function setValue(path: (string | number)[], value: unknown) {
    values.value = setPath(values.value, path, value) as Values
    serverErrors.value = serverErrors.value.filter((e) => e.field !== path.join('.'))
  }

  function setPreviewErrors(errors: FieldError[]) {
    serverErrors.value = errors
  }

  function saveOrganizationProfile() {
    saveOrganization(organization.value)
    organizationSaved.value = true
  }

  /** Creates the PDF + Notion record. Edits afterwards invalidate it (the API cannot patch `data`). */
  async function createDocument(signal?: AbortSignal) {
    if (!templateId.value || !schema.value) throw new Error('Pick a template first.')
    serverErrors.value = []
    const data = toPayload(schema.value, values.value) as Values
    const name =
      textAt(data, ['project', 'invoiceNumber']) ||
      `${templateId.value}-${new Date().toISOString().slice(0, 10)}`
    write(IDS_KEY, ids.value)

    try {
      document.value = await templatesApi.createDocument(
        {
          name,
          template: templateId.value,
          userId: ids.value.userId.trim(),
          contactId: ids.value.contactId.trim(),
          organizationId: organization.value.id,
          ...(ids.value.projectId.trim() ? { projectId: ids.value.projectId.trim() } : {}),
          data,
        },
        signal,
      )
    } catch (error) {
      if (error instanceof ApiError) serverErrors.value = error.fields
      throw error
    }

    if (templateId.value === 'invoice') {
      try {
        localStorage.setItem(SEQ_KEY, String(readSeq() + 1))
      } catch {
        // Best-effort counter.
      }
    }
    email.value = buildEmail(data)
    return document.value
  }

  function buildEmail(data: Values): EmailDraft {
    const recipientName = textAt(data, ['recipient', 'name'])
    const title = textAt(data, ['project', 'title'])
    const number = document.value?.name ?? ''
    const due = formatDate(textAt(data, ['dueDate']))
    const sender = organization.value.name || organization.value.legalName
    const label = template.value?.label ?? 'document'
    const amount = showAmountDue.value
      ? ` The amount due is ${formatInr(totals.value.amountDue)}${due ? `, payable by ${due}` : ''}.`
      : ''
    return {
      to: textAt(data, ['recipient', 'email']),
      cc: organization.value.billingEmail,
      subject: `${label} ${number}${title ? ` · ${title}` : ''}`.trim(),
      message: [
        `Hi ${recipientName || 'there'},`,
        '',
        `Please find attached ${label.toLowerCase()} ${number}${title ? ` for ${title}` : ''}.${amount}`,
        '',
        'Thanks,',
        sender,
      ].join('\n'),
    }
  }

  function reset() {
    templateId.value = null
    template.value = null
    values.value = {}
    document.value = null
    serverErrors.value = []
    email.value = { to: '', cc: '', subject: '', message: '' }
  }

  // Edits after creation make the generated PDF stale.
  watch([values, ids], () => (document.value = null), { deep: true })
  // `sync` so the flag is accurate right after the profile is assigned.
  watch(organization, () => (organizationSaved.value = false), { deep: true, flush: 'sync' })

  watch(
    [templateId, values],
    () => write(DRAFT_KEY, { templateId: templateId.value, values: values.value } satisfies Draft),
    { deep: true },
  )

  return {
    templateId,
    template,
    schema,
    values,
    organization,
    organizationSaved,
    ids,
    document,
    serverErrors,
    fieldErrors,
    email,
    totals,
    showAmountDue,
    previewVariables,
    problems,
    applyTemplate,
    selectTemplate,
    setValue,
    setPreviewErrors,
    saveOrganizationProfile,
    createDocument,
    reset,
  }
})