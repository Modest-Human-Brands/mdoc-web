import type { JsonSchema } from '@/api'

export const EXCLUDED_ROOT_KEYS: readonly string[] = ['organization']

export type Values = Record<string, unknown>

export function isObjectSchema(schema: JsonSchema): boolean {
  return schema.type === 'object' || schema.properties !== undefined
}

export function isNumeric(schema: JsonSchema): boolean {
  return schema.type === 'number' || schema.type === 'integer'
}

export function orderedProperties(schema: JsonSchema): [string, JsonSchema][] {
  const entries = Object.entries(schema.properties ?? {})
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry[1]['x-order'] ?? a.index) - (b.entry[1]['x-order'] ?? b.index))
    .map(({ entry }) => entry)
}

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

export function textAt(data: unknown, path: (string | number)[]): string {
  const value = getPath(data, path)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

export function setPath(data: unknown, path: (string | number)[], value: unknown): unknown {
  const [head, ...rest] = path
  if (head === undefined) return value
  const isIndex = typeof head === 'number'
  const base: unknown = isIndex ? (Array.isArray(data) ? [...data] : []) : { ...(data as object) }
  const container = base as Record<string | number, unknown>
  container[head] = setPath(container[head], rest, value)
  return base
}

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

export function autoPaths(schema: JsonSchema, prefix: string[] = []): string[][] {
  if (isObjectSchema(schema)) {
    return orderedProperties(schema).flatMap(([key, child]) => autoPaths(child, [...prefix, key]))
  }
  return schema['x-auto'] && schema.type !== 'array' ? [prefix] : []
}

export function ownNumberPath(schema: JsonSchema): string[] | null {
  const paths = autoPaths(schema)
  return paths.find((p) => p[p.length - 1] === 'invoiceNumber') ?? paths[0] ?? null
}

export function schemaDefaults(
  schema: JsonSchema,
  overrides: Record<string, string> = {},
  prefix: string[] = [],
): Values {
  const result: Values = {}
  for (const [key, child] of orderedProperties(schema)) {
    const path = [...prefix, key]
    const dotted = path.join('.')
    if (dotted in overrides) {
      result[key] = overrides[dotted]
    } else if (isObjectSchema(child)) {
      const nested = schemaDefaults(child, overrides, path)
      if (Object.keys(nested).length > 0) result[key] = nested
    } else if (child.type !== 'array') {
      const value = child.default
      if (typeof value === 'boolean') result[key] = value
      else if (typeof value === 'string' || typeof value === 'number') result[key] = String(value)
    }
  }
  return result
}

export function singularLabel(title: string): string {
  const text = title.replace(/ies$/i, 'y').replace(/s$/i, '')
  return text.charAt(0).toUpperCase() + text.slice(1)
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
  path: string
  message: string
  kind: 'required' | 'invalid'
  hint?: string
}

function hasText(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.some(hasText)
  if (value !== null && typeof value === 'object') return Object.values(value).some(hasText)
  return false
}

export function isBlankRow(schema: JsonSchema, value: unknown): boolean {
  return !hasText(toPayload(schema, value))
}