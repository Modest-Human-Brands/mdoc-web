import type { Router } from 'vue-router'

import {
  ApiError,
  documentsApi,
  fetchTemplateDetail,
  templatesApi,
  type TemplateDetail,
} from '@/api'
import {
  ENTITY_TYPES,
  FONTS,
  isEmail,
  normalizeHex,
  type OrganizationProfile,
} from '@/domain/organization'
import { emptyValue, getPath, stripExcluded, textAt, toPayload, type Values } from '@/domain/schema'
import { STEPS, useWizardStore } from '@/stores/wizard'

import { coerce, editablePaths, resolveList, resolvePath, type PathSegment } from './paths'
import type { AgentClient, ModelContextTool, ToolResult } from './types'

export interface ToolDeps {
  wizard: ReturnType<typeof useWizardStore>
  router: Pick<Router, 'push' | 'currentRoute'>
  confirm: (message: string, client?: AgentClient) => Promise<boolean>
}

type Args = Record<string, unknown>

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(message: string, details?: Record<string, unknown>): ToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: message, ...details }, null, 2) }],
  }
}

function isRecord(value: unknown): value is Args {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function messageOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong.'
}

function pathArg(args: Args): string {
  return typeof args.path === 'string' ? args.path : ''
}

const NO_TEMPLATE = 'No template is loaded. Call select_template first.'

function missingRow(values: unknown, segments: PathSegment[]): string | null {
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (typeof segment !== 'number') continue
    const prefix = segments.slice(0, i)
    const list = getPath(values, prefix)
    if (!Array.isArray(list) || list.length <= segment) {
      return `Row ${segment} of "${prefix.join('.')}" does not exist; call add_row first.`
    }
  }
  return null
}

const STRING = { type: 'string' } as const
const NONE = { type: 'object', properties: {} } as const

const ORGANIZATION_KEYS = [
  'id',
  'name',
  'legalName',
  'entityType',
  'pan',
  'gstin',
  'primary',
  'accent',
  'font',
  'contactEmail',
  'billingEmail',
  'phone',
] as const

export function createTools(deps: ToolDeps): ModelContextTool[] {
  const { wizard, router, confirm } = deps

  const tool = (
    name: string,
    description: string,
    inputSchema: ModelContextTool['inputSchema'],
    readOnly: boolean,
    execute: (args: Args, client?: AgentClient) => Promise<ToolResult> | ToolResult,
  ): ModelContextTool => ({
    name,
    description,
    inputSchema,
    annotations: { readOnlyHint: readOnly },
    execute: async (args, client) => {
      try {
        return await execute(isRecord(args) ? args : {}, client)
      } catch (error) {
        return fail(messageOf(error))
      }
    },
  })

  const currentStep = () => {
    const path = router.currentRoute.value.path
    return STEPS.find((s) => s.path === path)?.name ?? null
  }

  return [
    tool(
      'get_wizard_state',
      'Where the "New document" wizard is: current step, selected template, what is still missing before a document can be created, server validation errors, the amount due (billing templates) and the created document if any. Call this first and after changes.',
      NONE,
      true,
      () =>
        ok({
          step: currentStep(),
          template: wizard.template
            ? { id: wizard.template.id, label: wizard.template.label }
            : wizard.templateId
              ? { id: wizard.templateId, label: null, loading: true }
              : null,
          organizationId: wizard.organization.id,
          ownerIds: {
            userId: wizard.ids.userId !== '',
            contactId: wizard.ids.contactId !== '',
            projectId: wizard.ids.projectId !== '',
          },
          missing: wizard.problems,
          serverErrors: wizard.serverErrors,
          amountDue: wizard.showAmountDue ? wizard.totals : null,
          preview: wizard.preview,
          document: wizard.document,
        }),
    ),

    tool(
      'list_templates',
      'Lists the document templates the server offers (id, label, shortLabel, category, description, sampleUrl).',
      NONE,
      true,
      async () => {
        const templates = await templatesApi.list()
        return ok(templates)
      },
    ),

    tool(
      'get_template_schema',
      'Returns the JSON Schema of a template (defaults to the selected one): fields, types, enums, required lists and layout hints. Branding (organization) is resolved by the server and is not part of it.',
      { type: 'object', properties: { templateId: STRING } },
      true,
      async (args) => {
        const id = typeof args.templateId === 'string' ? args.templateId : wizard.templateId
        if (!id) return fail('Give a templateId or select a template first.')
        const detail: TemplateDetail = await fetchTemplateDetail(id)
        return ok({
          id: detail.id,
          label: detail.label,
          description: detail.description,
          schema: stripExcluded(detail.schema),
          note: 'Set fields with set_fields using dotted paths, e.g. "recipient.name" or "project.deliverables.0.rate". Dates are YYYY-MM-DD.',
        })
      },
    ),

    tool(
      'get_form_values',
      'Returns the current form values: `form` as typed so far, and `payload` as it would be sent to the API.',
      NONE,
      true,
      () => ({
        content: ok({
          form: wizard.values,
          payload: wizard.schema ? toPayload(wizard.schema, wizard.values) : null,
        }).content,
      }),
    ),

    tool(
      'validate_form',
      'Checks the form against the template schema and the required owner ids. Returns the list of missing fields (empty means ready to create).',
      NONE,
      true,
      () => ok({ ready: wizard.problems.length === 0, problems: wizard.problems }),
    ),

    tool(
      'get_preview_status',
      'Status of the live PDF preview: loading, ready, page count, and the last error. `hints` lists fields the server replaced with placeholders because their value was invalid.',
      NONE,
      true,
      () => ok({ ...wizard.preview, hints: wizard.previewHints, fieldErrors: wizard.serverErrors }),
    ),

    tool(
      'select_template',
      'Selects a template (see list_templates), loads its schema and applies defaults. Resets previously entered values.',
      { type: 'object', properties: { templateId: STRING }, required: ['templateId'] },
      false,
      async (args) => {
        if (typeof args.templateId !== 'string') return fail('templateId is required.')
        const detail = await wizard.loadTemplate(args.templateId)
        return ok({
          selected: { id: detail.id, label: detail.label },
          missing: wizard.problems,
          hint: 'Call get_template_schema, then set_fields.',
        })
      },
    ),

    tool(
      'go_to_step',
      'Navigates the wizard. Steps: template, brand, details, review. The router may redirect (e.g. review needs a created document).',
      {
        type: 'object',
        properties: { step: { type: 'string', enum: STEPS.map((s) => s.name) } },
        required: ['step'],
      },
      false,
      async (args) => {
        const target = STEPS.find((s) => s.name === args.step)
        if (!target)
          return fail(`Unknown step. Use one of: ${STEPS.map((s) => s.name).join(', ')}.`)
        await router.push(target.path)
        const now = currentStep()
        return ok({
          requested: target.name,
          step: now,
          redirected: now !== target.name,
          ...(now !== target.name
            ? { reason: 'A previous step is incomplete (template selected / document created).' }
            : {}),
        })
      },
    ),

    tool(
      'set_fields',
      'Sets form fields in one call, all or nothing. Keys are dotted paths from the template schema (list rows by index), values are strings, numbers or booleans. Example: {"recipient.name":"Chai Theory","project.deliverables.0.rate":120000,"financials.isDiscountPercentage":true}. Use add_row first for new list rows.',
      {
        type: 'object',
        properties: { fields: { type: 'object', additionalProperties: true } },
        required: ['fields'],
      },
      false,
      (args) => {
        const schema = wizard.schema
        if (!schema) return fail(NO_TEMPLATE)
        if (!isRecord(args.fields)) return fail('fields must be an object of path → value.')

        const plan: { segments: PathSegment[]; value: string | boolean }[] = []
        const errors: string[] = []
        for (const [path, raw] of Object.entries(args.fields)) {
          const resolved = resolvePath(schema, path)
          if (!resolved.ok) {
            errors.push(resolved.reason)
            continue
          }
          if (wizard.isAutoLocked(resolved.segments.join('.'))) {
            errors.push(
              `"${path}" is generated by the server (the next document number) and cannot be set.`,
            )
            continue
          }
          const row = missingRow(wizard.values, resolved.segments)
          if (row) {
            errors.push(row)
            continue
          }
          const value = coerce(resolved.schema, path, raw)
          if (!value.ok) errors.push(value.reason)
          else plan.push({ segments: resolved.segments, value: value.value })
        }
        if (errors.length > 0) {
          return fail('No fields were changed.', {
            errors,
            validPaths: editablePaths(schema, wizard.values),
          })
        }
        for (const { segments, value } of plan) wizard.setValue(segments, value)
        return ok({ applied: plan.length, missing: wizard.problems })
      },
    ),

    tool(
      'add_row',
      'Appends an empty row to a list in the form (e.g. path "project.deliverables" for another service, or a list of points).',
      { type: 'object', properties: { path: STRING }, required: ['path'] },
      false,
      (args) => {
        const schema = wizard.schema
        if (!schema) return fail(NO_TEMPLATE)
        const list = resolveList(schema, pathArg(args))
        if (!list.ok) return fail(list.reason)
        const current = getPath(wizard.values, list.segments)
        const rows = Array.isArray(current) ? current : []
        wizard.setValue(list.segments, [
          ...rows,
          list.schema.items ? emptyValue(list.schema.items) : '',
        ])
        return ok({ path: list.segments.join('.'), rows: rows.length + 1 })
      },
    ),

    tool(
      'remove_row',
      'Removes a row from a list in the form by index. The last remaining row cannot be removed.',
      {
        type: 'object',
        properties: { path: STRING, index: { type: 'integer', minimum: 0 } },
        required: ['path', 'index'],
      },
      false,
      (args) => {
        const schema = wizard.schema
        if (!schema) return fail(NO_TEMPLATE)
        const list = resolveList(schema, pathArg(args))
        if (!list.ok) return fail(list.reason)
        const current = getPath(wizard.values, list.segments)
        const rows = Array.isArray(current) ? current : []
        const index = Number(args.index)
        if (!Number.isInteger(index) || index < 0 || index >= rows.length) {
          return fail(`index must be between 0 and ${rows.length - 1}.`)
        }
        if (rows.length === 1) return fail('The last row cannot be removed.')
        wizard.setValue(
          list.segments,
          rows.filter((_, i) => i !== index),
        )
        return ok({ path: list.segments.join('.'), rows: rows.length - 1 })
      },
    ),

    tool(
      'set_organization',
      `Sets the organisation profile (Brand step). "id" picks the server's branding preset; any other field you set overrides that preset on the generated PDF (untouched fields keep the preset's values) and is cached on this device. Keys: ${ORGANIZATION_KEYS.join(', ')}.`,
      {
        type: 'object',
        properties: Object.fromEntries(ORGANIZATION_KEYS.map((key) => [key, STRING])),
      },
      false,
      (args) => {
        const unknown = Object.keys(args).filter(
          (key) => !(ORGANIZATION_KEYS as readonly string[]).includes(key),
        )
        if (unknown.length > 0) return fail(`Unknown keys: ${unknown.join(', ')}.`)
        const next: Partial<OrganizationProfile> = {}
        const errors: string[] = []
        for (const key of ORGANIZATION_KEYS) {
          const value = args[key]
          if (value === undefined) continue
          if (typeof value !== 'string') {
            errors.push(`"${key}" must be a string.`)
            continue
          }
          const text = value.trim()
          if (key === 'entityType') {
            const entity = ENTITY_TYPES.find((e) => e.toLowerCase() === text.toLowerCase())
            if (entity) next.entityType = entity
            else errors.push(`entityType must be one of: ${ENTITY_TYPES.join(', ')}.`)
          } else if (key === 'primary' || key === 'accent') {
            const hex = normalizeHex(text)
            if (hex) next[key] = hex
            else errors.push(`"${key}" must be a hex colour such as #5945EA (got "${value}").`)
          } else if (key === 'font') {
            const font = FONTS.find((f) => f.toLowerCase() === text.toLowerCase())
            if (font) next.font = font
            else errors.push(`font must be one of: ${FONTS.join(', ')}.`)
          } else if (key === 'contactEmail' || key === 'billingEmail') {
            if (text === '' || isEmail(text)) next[key] = text
            else errors.push(`"${key}" must be a valid email address (got "${value}").`)
          } else if (key === 'id' && text === '') {
            errors.push('id cannot be empty.')
          } else {
            ;(next as Record<string, string>)[key] = text
          }
        }
        if (errors.length > 0) return fail('No organisation fields were changed.', { errors })
        Object.assign(wizard.organization, next)
        wizard.saveOrganizationProfile()
        return ok({ organizationId: wizard.organization.id })
      },
    ),

    tool(
      'set_owner_ids',
      'Sets the Notion ids the API requires when saving: userId and contactId (required), projectId (optional).',
      {
        type: 'object',
        properties: { userId: STRING, contactId: STRING, projectId: STRING },
      },
      false,
      (args) => {
        for (const key of ['userId', 'contactId', 'projectId'] as const) {
          const value = args[key]
          if (value === undefined) continue
          if (typeof value !== 'string') return fail(`"${key}" must be a string.`)
          wizard.ids[key] = value.trim()
        }
        return ok({ missing: wizard.problems.filter((p) => p.path.startsWith('ids.')) })
      },
    ),

    tool(
      'create_document',
      'Creates the PDF and saves it as a document in Notion. This has a real side effect, so the user is asked to confirm first. Requires validate_form to report no problems.',
      NONE,
      false,
      async (_args, client) => {
        if (!wizard.templateId || !wizard.schema) return fail(NO_TEMPLATE)
        if (wizard.problems.length > 0) {
          return fail('The form is not ready to create.', { problems: wizard.problems })
        }
        const payload = toPayload(wizard.schema, wizard.values) as Values
        const who = textAt(payload, ['recipient', 'name'])
        const approved = await confirm(
          `An AI assistant wants to create "${wizard.template?.label ?? wizard.templateId}"${who ? ` for ${who}` : ''}. This saves a document to Notion. Allow?`,
          client,
        )
        if (!approved) return fail('The user declined to create the document.')

        try {
          const doc = await wizard.createDocument()
          await router.push(STEPS[3].path)
          return ok({
            documentId: doc.id,
            name: doc.name,
            sizeBytes: doc.sizeBytes,
            downloadUrl: new URL(
              documentsApi.contentUrl(doc.id, { download: true }),
              window.location.origin,
            ).href,
            step: currentStep(),
          })
        } catch (error) {
          return fail(messageOf(error), { fieldErrors: wizard.serverErrors })
        }
      },
    ),

    tool(
      'reset_wizard',
      'Clears the template, form values and created document and returns to the first step.',
      NONE,
      false,
      async () => {
        wizard.reset()
        await router.push(STEPS[0].path)
        return ok({ step: currentStep() })
      },
    ),
  ]
}