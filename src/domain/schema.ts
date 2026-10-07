import type { JsonSchema } from '@/api'

/** Root properties handled outside the form (resolved on the server from `organizationId`). */
export const EXCLUDED_ROOT_KEYS: readonly string[] = ['organization']

export type Values = Record<string, unknown>

export function isObjectSchema(schema: JsonSchema): boolean {
  return schema.type === 'object' || schema.properties !== undefined
}

export function isNumeric(schema: JsonSchema): boolean {
  return schema.type === 'number' || schema.type === 'integer'
}

/** Properties in design order (`x-order`, then declaration order). */
export function orderedProperties(schema: JsonSchema): [string, JsonSchema][] {
  const entries = Object.entries(schema.properties ?? {})
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry[1]['x-order'] ?? a.index) - (b.entry[1]['x-order'] ?? b.index))
    .map(({ entry }) => entry)
}

/** "recipient.email" → "Recipient email"; used when the server sends only a path. */
export function labelFromPath(path: string): string {
  const last = path.split('.').pop() ?? path
  const spaced = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

export function getPath(data: unknown, path: (string | number)[]): unknown {
  let current: unknown = data
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string | number, unknown>)[segment]
  }
  return current
}

/** Reads a leaf as text; anything that is not a string or number becomes ''. */
export function textAt(data: unknown, path: (string | number)[]): string {
  const value = getPath(data, path)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

/** Immutable update; creates missing objects/arrays on the way. */
export function setPath(data: unknown, path: (string | number)[], value: unknown): unknown {
  const [head, ...rest] = path
  if (head === undefined) return value
  const isIndex = typeof head === 'number'
  const base: unknown = isIndex ? (Array.isArray(data) ? [...data] : []) : { ...(data as object) }
  const container = base as Record<string | number, unknown>
  container[head] = setPath(container[head], rest, value)
  return base
}

/** Blank form state: strings are '', arrays hold one empty item so the user sees a row. */
export function emptyValue(schema: JsonSchema): unknown {
  if (isObjectSchema(schema)) {
    return Object.fromEntries(
      orderedProperties(schema).map(([key, child]) => [key, emptyValue(child)]),
    )
  }
  if (schema.type === 'array') return schema.items ? [emptyValue(schema.items)] : []
  if (schema.type === 'boolean') return false
  return ''
}

/** Deep-merges `defaults` under `values`: defaults only fill blanks (undefined or ''). */
export function withDefaults(values: unknown, defaults: unknown): unknown {
  if (Array.isArray(defaults)) {
    if (!Array.isArray(values) || values.length === 0) return defaults
    const [first] = defaults
    return first === undefined ? values : values.map((item) => withDefaults(item, first))
  }
  if (defaults !== null && typeof defaults === 'object') {
    const v = values !== null && typeof values === 'object' ? (values as Values) : {}
    const result: Values = {}
    for (const key of new Set([...Object.keys(defaults), ...Object.keys(v)])) {
      result[key] = withDefaults(v[key], (defaults as Values)[key])
    }
    return result
  }
  return values === undefined || values === '' ? defaults : values
}

/** Overlays `source` onto `base` for keys present in source; nested objects recurse. */
export function overlay(base: unknown, source: unknown): unknown {
  if (source === undefined) return base
  if (
    base !== null &&
    typeof base === 'object' &&
    !Array.isArray(base) &&
    source !== null &&
    typeof source === 'object' &&
    !Array.isArray(source)
  ) {
    const result: Values = { ...(base as Values) }
    for (const [key, value] of Object.entries(source as Values)) {
      result[key] = overlay(result[key], value)
    }
    return result
  }
  return source
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Placeholder content so a preview renders before the user has typed anything. */
export function sampleValue(schema: JsonSchema, key = ''): unknown {
  if (isObjectSchema(schema)) {
    return Object.fromEntries(
      orderedProperties(schema).map(([k, child]) => [k, sampleValue(child, k)]),
    )
  }
  if (schema.type === 'array') return schema.items ? [sampleValue(schema.items, key)] : []
  if (schema.enum && schema.enum.length > 0) return schema.enum[0]
  if (schema.type === 'boolean') return false
  if (isNumeric(schema)) return schema.minimum ?? 0
  if (schema.format === 'date' || schema.format === 'date-time') return today()
  if (schema.format === 'email') return 'name@example.com'
  if (/phone/i.test(key)) return '+91 00000 00000'
  return schema.title ? `${schema.title}` : 'Sample text'
}

/**
 * Converts form state to the API shape: numbers are parsed, blanks become `undefined` (dropped on
 * JSON serialisation so defaults can fill them), strings are trimmed.
 */
export function toPayload(schema: JsonSchema, value: unknown): unknown {
  if (isObjectSchema(schema)) {
    const source = value !== null && typeof value === 'object' ? (value as Values) : {}
    const result: Values = {}
    for (const [key, child] of orderedProperties(schema)) {
      const converted = toPayload(child, source[key])
      if (converted !== undefined) result[key] = converted
    }
    return Object.keys(result).length > 0 ? result : undefined
  }
  if (schema.type === 'array') {
    const items = Array.isArray(value) ? value : []
    const converted = items
      .map((item) => (schema.items ? toPayload(schema.items, item) : item))
      .filter((item) => item !== undefined)
    return converted.length > 0 ? converted : undefined
  }
  if (schema.type === 'boolean') return value === true
  if (isNumeric(schema)) {
    const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : ''
    const parsed = Number.parseFloat(text.replace(/[^0-9.-]/g, ''))
    return text.trim() === '' || !Number.isFinite(parsed) ? undefined : parsed
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
  }
  return value ?? undefined
}

/** The payload the renderer receives while editing: user input over placeholders. */
export function previewPayload(schema: JsonSchema, values: unknown): Values {
  const filtered = stripExcluded(schema)
  const sample = sampleValue(filtered)
  const payload = toPayload(filtered, values)
  return overlay(sample, payload) as Values
}

export function stripExcluded(schema: JsonSchema): JsonSchema {
  if (!schema.properties) return schema
  const properties = Object.fromEntries(
    Object.entries(schema.properties).filter(([key]) => !EXCLUDED_ROOT_KEYS.includes(key)),
  )
  return {
    ...schema,
    properties,
    required: schema.required?.filter((key) => !EXCLUDED_ROOT_KEYS.includes(key)),
  }
}

export interface Problem {
  /** Dotted path, e.g. `project.deliverables.0.title`. */
  path: string
  message: string
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

/** Client-side check of the schema's `required` lists, so users fix gaps before "Review & send". */
export function missingRequired(
  schema: JsonSchema,
  values: unknown,
  path: string[] = [],
): Problem[] {
  const target = path.length === 0 ? stripExcluded(schema) : schema
  if (isObjectSchema(target)) {
    const source = values !== null && typeof values === 'object' ? (values as Values) : {}
    return orderedProperties(target).flatMap(([key, child]) => {
      const here = [...path, key]
      if (
        target.required?.includes(key) &&
        !isObjectSchema(child) &&
        !hasValue(child, source[key])
      ) {
        return [
          { path: here.join('.'), message: `${child.title ?? labelFromPath(key)} is required` },
        ]
      }
      return missingRequired(child, source[key], here)
    })
  }
  if (target.type === 'array' && target.items) {
    return (Array.isArray(values) ? values : []).flatMap((item, index) =>
      isBlankItem(target.items!, item)
        ? []
        : missingRequired(target.items!, item, [...path, String(index)]),
    )
  }
  return []
}

/** True when a converted value contains at least one non-empty string. */
function hasText(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.some(hasText)
  if (value !== null && typeof value === 'object') return Object.values(value).some(hasText)
  return false
}

/**
 * A row counts as filled only once the user has typed some text in it. Defaults such as
 * `quantity: 1` must not turn an untouched row into a "filled" one.
 */
function isBlankItem(schema: JsonSchema, value: unknown): boolean {
  return !hasText(toPayload(schema, value))
}

function hasValue(schema: JsonSchema, value: unknown): boolean {
  if (schema.type === 'array') {
    return (Array.isArray(value) ? value : []).some((item) =>
      schema.items ? !isBlankItem(schema.items, item) : !isBlank(item),
    )
  }
  if (isObjectSchema(schema)) return toPayload(schema, value) !== undefined
  if (schema.type === 'boolean') return typeof value === 'boolean'
  return !isBlank(value)
}

export function problemMap(problems: Problem[]): Record<string, string> {
  return Object.fromEntries(problems.map((p) => [p.path, p.message]))
}