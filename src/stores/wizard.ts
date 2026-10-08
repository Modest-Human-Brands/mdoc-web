import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useNotForm } from 'notform'

import {
  ApiError,
  documentsApi,
  fetchTemplateDetail,
  templatesApi,
  type CreateDocumentResponse,
  type FieldError,
  type PreviewWarning,
  type TemplateDetail,
} from '@/api'
import { config } from '@/config'
import { buildFormSchema, emptyFormSchema, validateForm } from '@/domain/formSchema'
import {
  computeTotals,
  hasBilling,
  IGNORED_SERVER_DEFAULTS,
  templateDefaults,
} from '@/domain/invoice'
import {
  loadOrganization,
  saveOrganization,
  toOrganizationOverride,
  type OrganizationProfile,
} from '@/domain/organization'
import { organizationFormSchema } from '@/domain/organizationForm'
import {
  emptyValue,
  ownNumberPath,
  schemaDefaults,
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
  { name: 'review', label: 'Review & download', path: '/new/review' },
] as const

export interface OwnerIds {
  userId: string
  contactId: string
  projectId: string
}

const DRAFT_KEY = 'mdoc.draft'
const IDS_KEY = 'mdoc.ids'

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
  } catch {}
}

export const useWizardStore = defineStore('wizard', () => {
  const saved = read<Partial<Draft>>(DRAFT_KEY)

  const templateId = ref<string | null>(saved?.templateId ?? null)
  const template = ref<TemplateDetail | null>(null)
  const schema = computed(() => (template.value ? stripExcluded(template.value.schema) : null))
  const formSchema = computed(() =>
    schema.value ? buildFormSchema(schema.value) : emptyFormSchema,
  )

  const form = useNotForm({
    schema: () => formSchema.value,
    initialValues: saved?.values ?? {},
  })
  const values = form.values as Values

  const organizationForm = useNotForm({
    schema: organizationFormSchema,
    initialValues: loadOrganization(),
  })
  const organization = organizationForm.values as OrganizationProfile
  const organizationSaved = ref(true)
  const ids = ref<OwnerIds>({
    userId: config.userId,
    contactId: config.contactId,
    projectId: config.projectId,
    ...read<Partial<OwnerIds>>(IDS_KEY),
  })
  const document = ref<CreateDocumentResponse | null>(null)
  const serverErrors = ref<FieldError[]>([])

  const totals = computed(() => computeTotals(values))
  const showAmountDue = computed(() => hasBilling(values))

  const organizationOverride = computed(() => toOrganizationOverride(organization))

  const organizationFields = computed<Values>(() =>
    organizationOverride.value
      ? { organization: organizationOverride.value }
      : { organizationId: organization.id },
  )

  const brandPreviewVariables = computed<Values>(() => ({ ...organizationFields.value }))

  const previewVariables = computed<Values>(() => ({
    ...((schema.value ? toPayload(schema.value, values) : undefined) as Values | undefined),
    ...organizationFields.value,
  }))

  const problems = computed<Problem[]>(() => {
    const list = schema.value ? validateForm(formSchema.value, values) : []
    if (!ids.value.userId.trim()) {
      list.push({
        path: 'ids.userId',
        kind: 'required',
        message: 'User ID is not configured',
      })
    }
    if (!ids.value.contactId.trim()) {
      list.push({
        path: 'ids.contactId',
        kind: 'required',
        message: 'Contact ID is not configured',
      })
    }
    return list
  })

  const idsReady = computed(
    () => ids.value.userId.trim() !== '' && ids.value.contactId.trim() !== '',
  )

  const clientErrors = computed<Record<string, string>>(() =>
    Object.fromEntries(
      problems.value.filter((p) => p.kind === 'invalid').map((p) => [p.path, p.hint ?? p.message]),
    ),
  )

  const previewWarnings = ref<PreviewWarning[]>([])

  const previewHints = computed<Record<string, string>>(() =>
    Object.fromEntries(
      previewWarnings.value
        .filter(
          (w) =>
            textAt(
              values,
              w.field.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)),
            ) !== '',
        )
        .map((w) => [w.field, w.message]),
    ),
  )

  const externalErrors = computed<Record<string, string>>(() => {
    const result: Record<string, string> = { ...previewHints.value }
    for (const error of serverErrors.value) result[error.field] = error.message
    return result
  })

  const fieldErrors = computed<Record<string, string>>(() => ({
    ...previewHints.value,
    ...clientErrors.value,
    ...externalErrors.value,
  }))

  function applyTemplate(detail: TemplateDetail) {
    template.value = detail
    const stripped = stripExcluded(detail.schema)
    const blank = emptyValue(stripped) as Values
    const serverDefaults = schemaDefaults(stripped, IGNORED_SERVER_DEFAULTS)
    form.reset(
      withDefaults(
        withDefaults(withDefaults(values, templateDefaults(detail.id)), serverDefaults),
        blank,
      ) as Values,
    )
  }

  const lockedNumberPath = ref<string | null>(null)
  const numberError = ref<string | null>(null)
  let numberTicket = 0

  const numberPath = computed(() => (schema.value ? ownNumberPath(schema.value) : null))

  function isAutoLocked(path: string): boolean {
    return lockedNumberPath.value !== null && lockedNumberPath.value === path
  }

  async function prefillNumber() {
    const path = numberPath.value
    const id = templateId.value
    const mine = ++numberTicket
    numberError.value = null
    if (!path || !id) {
      lockedNumberPath.value = null
      return
    }
    try {
      const result = await documentsApi.nextNumber({
        templateId: id,
        organizationId: organization.id.trim() || undefined,
        organizationName: organization.name.trim() || undefined,
      })
      if (mine !== numberTicket || templateId.value !== id) return
      if (typeof result.number !== 'string' || result.number === '') {
        throw new Error('The server returned no number.')
      }
      form.setValue(path.join('.'), result.number)
      lockedNumberPath.value = path.join('.')
    } catch (error) {
      if (mine !== numberTicket) return
      lockedNumberPath.value = null
      numberError.value = error instanceof Error ? error.message : 'Could not get the next number.'
    }
  }

  const templateError = ref<string | null>(null)

  function selectTemplate(id: string | null) {
    if (templateId.value === id) return
    templateId.value = id
    template.value = null
    templateError.value = null
    lockedNumberPath.value = null
    numberError.value = null
    form.reset({})
    document.value = null
    serverErrors.value = []
  }

  async function loadTemplate(id: string) {
    const detail = await fetchTemplateDetail(id)
    selectTemplate(id)
    applyTemplate(detail)
    await prefillNumber()
    return detail
  }

  const preview = ref<{
    loading: boolean
    error: string | null
    ready: boolean
    pageCount: number
  }>({
    loading: false,
    error: null,
    ready: false,
    pageCount: 1,
  })

  function setValue(path: (string | number)[], value: unknown) {
    form.setValue(path.join('.'), value)
    serverErrors.value = serverErrors.value.filter((e) => e.field !== path.join('.'))
  }

  function setPreviewWarnings(warnings: PreviewWarning[]) {
    previewWarnings.value = warnings
  }

  function saveOrganizationProfile() {
    saveOrganization(organization)
    organizationSaved.value = true
  }

  async function createDocument(signal?: AbortSignal) {
    if (!templateId.value || !schema.value) throw new Error('Pick a template first.')
    serverErrors.value = []
    const data = toPayload(schema.value, values) as Values
    const numbered = numberPath.value ? textAt(data, numberPath.value) : ''
    const name = numbered || `${templateId.value}-${new Date().toISOString().slice(0, 10)}`
    write(IDS_KEY, ids.value)

    try {
      document.value = await templatesApi.createDocument(
        {
          name,
          template: templateId.value,
          userId: ids.value.userId.trim(),
          contactId: ids.value.contactId.trim(),
          ...(organizationOverride.value ? {} : { organizationId: organization.id }),
          ...(ids.value.projectId.trim() ? { projectId: ids.value.projectId.trim() } : {}),
          data: organizationOverride.value
            ? { ...data, organization: organizationOverride.value }
            : data,
        },
        signal,
      )
    } catch (error) {
      if (error instanceof ApiError) serverErrors.value = error.fields
      throw error
    }

    return document.value
  }

  function reset() {
    templateId.value = null
    template.value = null
    form.reset({})
    document.value = null
    serverErrors.value = []
  }

  let numberTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    () => [organization.id, organization.name] as const,
    () => {
      clearTimeout(numberTimer)
      if (numberPath.value) numberTimer = setTimeout(() => void prefillNumber(), 600)
    },
  )

  watch([values, ids], () => (document.value = null), { deep: true })
  watch(organization, () => (organizationSaved.value = false), { deep: true, flush: 'sync' })

  watch(
    [templateId, values],
    () => write(DRAFT_KEY, { templateId: templateId.value, values: values } satisfies Draft),
    { deep: true },
  )

  return {
    templateId,
    template,
    schema,
    values,
    form,
    formSchema,
    organization,
    organizationForm,
    organizationSaved,
    ids,
    document,
    serverErrors,
    clientErrors,
    fieldErrors,
    externalErrors,
    totals,
    showAmountDue,
    organizationOverride,
    previewVariables,
    brandPreviewVariables,
    problems,
    idsReady,
    applyTemplate,
    prefillNumber,
    isAutoLocked,
    numberError,
    selectTemplate,
    loadTemplate,
    templateError,
    preview,
    setValue,
    setPreviewWarnings,
    previewHints,
    saveOrganizationProfile,
    createDocument,
    reset,
  }
})