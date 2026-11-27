import { computed, nextTick, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useDebounceFn, useStorage } from '@vueuse/core'
import { useNotForm } from 'notform'

import {
  ApiError,
  documentsApi,
  fetchTemplateDetail,
  organizationApi,
  templatesApi,
  type CreateDocumentResponse,
  type DocumentDetail,
  type FieldError,
  type PreviewWarning,
  type TemplateDetail,
} from '@/api'
import { config } from '@/config'
import { recipientPatch, type Client } from '@/domain/clients'
import { keepUnlistedFields, toFormValues } from '@/domain/documentForm'
import { buildFormSchema, emptyFormSchema, validateForm } from '@/domain/formSchema'
import {
  computeTotals,
  hasBilling,
  IGNORED_SERVER_DEFAULTS,
  templateDefaults,
} from '@/domain/invoice'
import {
  emptyOrganization,
  fromStoredOrganization,
  toOrganizationPatch,
  toPreviewOrganization,
  type OrganizationProfile,
  type OrganizationRecord,
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

export const BRAND_PATH = '/settings/brand'

export const STEPS = [
  { name: 'template', label: 'Template', path: '/new/template' },
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
  clientId: string | null
  values: Values
}

/** A saved Draft opened in the same form. Its template is fixed. */
export interface Editing {
  id: string
  name: string
  revision: string
  saved: Values
  /** Terms the saved document used that can no longer be chosen. */
  droppedTerms: string[]
  /** The form as opened, to tell whether anything was changed. */
  opened: string
}

export const useWizardStore = defineStore('wizard', () => {
  const draft = useStorage<Partial<Draft>>(DRAFT_KEY, {}, undefined, {
    listenToStorageChanges: false,
  })
  const saved = draft.value

  const templateId = ref<string | null>(saved?.templateId ?? null)
  const clientId = ref<string | null>(saved?.clientId ?? null)
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
  const editing = ref<Editing | null>(null)

  const organizationForm = useNotForm({
    schema: organizationFormSchema,
    initialValues: emptyOrganization(),
  })
  const organization = organizationForm.values as OrganizationProfile
  // Notion is the only store. These hold the record as last read, which edits are compared against.
  const organizationBaseline = ref<OrganizationProfile>(emptyOrganization())
  const organizationRevision = ref<string | null>(null)
  const organizationStatus = ref<'idle' | 'loading' | 'saving' | 'ready' | 'error'>('idle')
  const organizationError = ref<string | null>(null)
  const organizationChanges = computed(() =>
    toOrganizationPatch(organizationBaseline.value, organization),
  )
  const organizationSaved = computed(() => Object.keys(organizationChanges.value).length === 0)
  const savedIds = useStorage<Partial<OwnerIds>>(IDS_KEY, {}, undefined, {
    listenToStorageChanges: false,
  })
  const ids = ref<OwnerIds>({
    userId: config.userId,
    contactId: config.contactId,
    projectId: config.projectId,
    ...savedIds.value,
  })
  const document = ref<CreateDocumentResponse | null>(null)
  const serverErrors = ref<FieldError[]>([])

  const totals = computed(() => computeTotals(values))
  const showAmountDue = computed(() => hasBilling(values))

  // Saved branding is read from Notion by the server; only unsaved edits travel with a preview.
  const organizationFields = computed<Values>(() =>
    organizationSaved.value ? {} : { organization: toPreviewOrganization(organization) },
  )

  const brandPreviewVariables = computed<Values>(() => ({ ...organizationFields.value }))

  function currentData(): Values {
    if (!schema.value) return {}
    const payload = toPayload(schema.value, values) as Values | undefined
    // An edit also carries saved fields the form has no input for.
    return editing.value
      ? keepUnlistedFields(schema.value, editing.value.saved, payload)
      : { ...payload }
  }

  const previewVariables = computed<Values>(() => ({
    ...currentData(),
    ...organizationFields.value,
  }))

  const hasUnsavedEdits = computed(
    () =>
      editing.value !== null &&
      (editing.value.droppedTerms.length > 0 ||
        JSON.stringify(currentData()) !== editing.value.opened),
  )

  const problems = computed<Problem[]>(() => {
    const list = schema.value ? validateForm(formSchema.value, values) : []
    if (editing.value) return list
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
    // A saved document's values are shown as stored, with no template defaults filled in.
    if (editing.value) return
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

  const numberPath = computed(() =>
    schema.value ? ownNumberPath(schema.value, templateId.value) : null,
  )

  function isAutoLocked(path: string): boolean {
    return lockedNumberPath.value !== null && lockedNumberPath.value === path
  }

  async function prefillNumber() {
    // A saved document keeps the number it already has.
    if (editing.value) return
    const path = numberPath.value
    const id = templateId.value
    const mine = ++numberTicket
    numberError.value = null
    if (!path || !id) {
      lockedNumberPath.value = null
      return
    }
    try {
      const result = await documentsApi.nextNumber({ templateId: id })
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
  const submitAttempted = ref(false)
  const previewFlushes = ref(0)

  /** Discrete changes (selects, toggles, uploads) render at once instead of waiting for typing to settle. */
  function flushPreview() {
    previewFlushes.value++
  }

  function selectTemplate(id: string | null) {
    if (editing.value || templateId.value === id) return
    templateId.value = id
    clientId.value = null
    submitAttempted.value = false
    template.value = null
    templateError.value = null
    lockedNumberPath.value = null
    numberError.value = null
    form.reset({})
    document.value = null
    serverErrors.value = []
  }

  async function loadTemplate(id: string) {
    if (editing.value) {
      throw new Error('A saved document is open. Its template cannot be changed.')
    }
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

  function selectClient(client: Client, keys: readonly string[]) {
    clientId.value = client.id
    for (const [key, value] of Object.entries(recipientPatch(client, keys))) {
      setValue(['recipient', key], value)
    }
    flushPreview()
  }

  function clearClient() {
    clientId.value = null
  }

  function setPreviewWarnings(warnings: PreviewWarning[]) {
    previewWarnings.value = warnings
  }

  const copy = (profile: OrganizationProfile) =>
    JSON.parse(JSON.stringify(profile)) as OrganizationProfile

  function applyOrganization(record: OrganizationRecord) {
    const profile = fromStoredOrganization(record.organization)
    organizationBaseline.value = copy(profile)
    organizationForm.reset(profile)
    organizationRevision.value = record.revision
    organizationStatus.value = 'ready'
    organizationError.value = null
  }

  const messageOf = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback

  let organizationRequest: Promise<boolean> | null = null

  /** Reads the organisation from Notion, replacing whatever the form holds. */
  function loadOrganizationProfile(): Promise<boolean> {
    organizationRequest ??= (async () => {
      organizationStatus.value = 'loading'
      organizationError.value = null
      try {
        applyOrganization(await organizationApi.get())
        return true
      } catch (error) {
        organizationStatus.value = 'error'
        organizationError.value = messageOf(error, 'Could not load the organisation from Notion.')
        return false
      } finally {
        organizationRequest = null
      }
    })()
    return organizationRequest
  }

  function ensureOrganization(): Promise<boolean> {
    return organizationRevision.value === null ? loadOrganizationProfile() : Promise.resolve(true)
  }

  /** Writes the edited fields to Notion. On failure the edits stay in the form and `organizationError` says why. */
  async function saveOrganizationProfile(): Promise<boolean> {
    const revision = organizationRevision.value
    if (revision === null) {
      organizationError.value ??= 'The organisation has not been loaded from Notion yet.'
      return false
    }
    if (organizationSaved.value) return true
    organizationStatus.value = 'saving'
    organizationError.value = null
    try {
      applyOrganization(await organizationApi.update(revision, organizationChanges.value))
      return true
    } catch (error) {
      organizationStatus.value = 'ready'
      organizationError.value = messageOf(error, 'Could not save to Notion.')
      return false
    }
  }

  async function createDocument(signal?: AbortSignal) {
    if (editing.value) throw new Error('A saved document is open. Save your changes to it instead.')
    if (!templateId.value || !schema.value) throw new Error('Pick a template first.')
    serverErrors.value = []
    // A document is rendered from the Notion record, so unsaved branding would silently be left out.
    if (!organizationSaved.value) throw new Error('Save or discard your brand changes first.')
    const data = toPayload(schema.value, values) as Values
    const numbered = numberPath.value ? textAt(data, numberPath.value) : ''
    const name = numbered || `${templateId.value}-${new Date().toISOString().slice(0, 10)}`
    savedIds.value = { ...ids.value }

    try {
      document.value = await templatesApi.createDocument(
        {
          name,
          template: templateId.value,
          userId: ids.value.userId.trim(),
          contactId: ids.value.contactId.trim(),
          ...(ids.value.projectId.trim() ? { projectId: ids.value.projectId.trim() } : {}),
          data,
        },
        signal,
      )
    } catch (error) {
      if (error instanceof ApiError) serverErrors.value = error.fields
      throw error
    }

    return document.value
  }

  function discardOrganizationChanges() {
    organizationForm.reset(copy(organizationBaseline.value))
    organizationError.value = null
  }

  /** The unfinished new document, set aside while a saved one is open. */
  let setAside: {
    templateId: string | null
    clientId: string | null
    template: TemplateDetail | null
    values: string
    lockedNumberPath: string | null
    document: CreateDocumentResponse | null
  } | null = null

  function startEditing(saved: DocumentDetail, detail: TemplateDetail) {
    stopEditing()
    setAside = {
      templateId: templateId.value,
      clientId: clientId.value,
      template: template.value,
      values: JSON.stringify(values),
      lockedNumberPath: lockedNumberPath.value,
      document: document.value,
    }
    const data = (saved.rawData ?? {}) as Values
    // Set first: from here on the new-document draft is no longer written to.
    editing.value = {
      id: saved.id,
      name: saved.name,
      revision: saved.revision,
      saved: data,
      droppedTerms: [],
      opened: '',
    }
    numberTicket++
    numberError.value = null
    templateError.value = null
    submitAttempted.value = false
    serverErrors.value = []
    previewWarnings.value = []
    document.value = null
    clientId.value = null
    templateId.value = detail.id
    template.value = detail

    const dropped: string[] = []
    form.reset(toFormValues(stripExcluded(detail.schema), data, dropped) as Values)
    const path = numberPath.value
    lockedNumberPath.value = path && textAt(values, path) !== '' ? path.join('.') : null
    editing.value.droppedTerms = dropped
    editing.value.opened = JSON.stringify(currentData())
  }

  function stopEditing() {
    if (!editing.value || !setAside) return
    const previous = setAside
    setAside = null
    const editedTemplate = templateId.value === previous.templateId ? template.value : null
    editing.value = null
    templateId.value = previous.templateId
    clientId.value = previous.clientId
    template.value = previous.template ?? editedTemplate
    form.reset(JSON.parse(previous.values) as Values)
    lockedNumberPath.value = previous.lockedNumberPath
    submitAttempted.value = false
    serverErrors.value = []
    previewWarnings.value = []
    // Last, after the watcher that clears it when the values change.
    void nextTick(() => (document.value = previous.document))
  }

  async function saveDocumentEdits(signal?: AbortSignal) {
    const open = editing.value
    if (!open) throw new Error('No document is open for editing.')
    if (!organizationSaved.value) throw new Error('Save or discard your brand changes first.')
    serverErrors.value = []
    try {
      await documentsApi.edit(open.id, { revision: open.revision, data: currentData() }, signal)
    } catch (error) {
      if (error instanceof ApiError) serverErrors.value = error.fields
      throw error
    }
    stopEditing()
  }

  function reset() {
    // Not stopEditing(): everything is being cleared, so the set-aside draft must not come back.
    editing.value = null
    setAside = null
    templateId.value = null
    clientId.value = null
    submitAttempted.value = false
    template.value = null
    form.reset({})
    document.value = null
    serverErrors.value = []
  }

  const refreshNumber = useDebounceFn(() => {
    if (numberPath.value) void prefillNumber()
  }, 600)
  // The server numbers documents from the saved name, so only a save or reload can change a number.
  watch(
    () => organizationBaseline.value.name,
    (_, previous) => {
      if (previous !== '') void refreshNumber()
    },
  )

  watch([values, ids], () => (document.value = null), { deep: true })
  watch(
    () =>
      [
        organization.entityType,
        organization.tradeRelationship,
        organization.font,
        organization.logo,
      ] as const,
    () => flushPreview(),
  )

  watch(
    [templateId, clientId, values],
    () => {
      if (editing.value) return
      draft.value = {
        templateId: templateId.value,
        clientId: clientId.value,
        // A copy: the storage ref is watched deeply, and the live object also holds a document being edited.
        values: JSON.parse(JSON.stringify(values)) as Values,
      } satisfies Draft
    },
    { deep: true },
  )

  return {
    templateId,
    clientId,
    selectClient,
    clearClient,
    template,
    schema,
    values,
    form,
    formSchema,
    organization,
    organizationForm,
    organizationSaved,
    organizationStatus,
    organizationError,
    organizationRevision,
    loadOrganizationProfile,
    ensureOrganization,
    ids,
    document,
    serverErrors,
    clientErrors,
    fieldErrors,
    externalErrors,
    totals,
    showAmountDue,
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
    submitAttempted,
    previewFlushes,
    flushPreview,
    preview,
    setValue,
    setPreviewWarnings,
    previewHints,
    saveOrganizationProfile,
    discardOrganizationChanges,
    createDocument,
    editing,
    hasUnsavedEdits,
    startEditing,
    stopEditing,
    saveDocumentEdits,
    reset,
  }
})