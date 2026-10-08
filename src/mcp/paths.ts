import type { JsonSchema } from '@/api'
import { getPath, isObjectSchema, orderedProperties } from '@/domain/schema'
import { checkLeaf } from '@/domain/validate'

export type PathSegment = string | number

export function parsePath(path: string): PathSegment[] {
  return path
    .split('.')
    .filter((segment) => segment !== '')
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment))
}

export type PathResolution =
  | { ok: true; schema: JsonSchema; segments: PathSegment[] }
  | { ok: false; reason: string }

export function resolvePath(root: JsonSchema, path: string): PathResolution {
  const segments = parsePath(path)
  if (segments.length === 0) return { ok: false, reason: 'Empty path.' }

  let node: JsonSchema = root
  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (node.type !== 'array' || !node.items) {
        return {
          ok: false,
          reason: `"${path}": index ${segment} used on something that is not a list.`,
        }
      }
      node = node.items
    } else {
      const next = node.properties?.[segment]
      if (!next || !isObjectSchema(node)) {
        return { ok: false, reason: `"${path}": unknown field "${segment}".` }
      }
      node = next
    }
  }

  if (isObjectSchema(node))
    return { ok: false, reason: `"${path}" is a group; set its fields instead.` }
  if (node.type === 'array') {
    return {
      ok: false,
      reason: `"${path}" is a list; set an item (e.g. "${path}.0") or use add_row.`,
    }
  }
  return { ok: true, schema: node, segments }
}

export function resolveList(
  root: JsonSchema,
  path: string,
): { ok: true; schema: JsonSchema; segments: PathSegment[] } | { ok: false; reason: string } {
  const segments = parsePath(path)
  let node: JsonSchema = root
  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (node.type !== 'array' || !node.items)
        return { ok: false, reason: `"${path}": bad index.` }
      node = node.items
    } else {
      const next = node.properties?.[segment]
      if (!next) return { ok: false, reason: `"${path}": unknown field "${segment}".` }
      node = next
    }
  }
  if (node.type !== 'array') return { ok: false, reason: `"${path}" is not a list.` }
  return { ok: true, schema: node, segments }
}

export function editablePaths(
  schema: JsonSchema,
  values: unknown,
  prefix: PathSegment[] = [],
): string[] {
  const out: string[] = []
  if (isObjectSchema(schema)) {
    for (const [key, child] of orderedProperties(schema)) {
      out.push(...editablePaths(child, values, [...prefix, key]))
    }
  } else if (schema.type === 'array' && schema.items) {
    const rows = getPath(values, prefix)
    const count = Array.isArray(rows) ? rows.length : 0
    for (let i = 0; i < count; i++) out.push(...editablePaths(schema.items, values, [...prefix, i]))
  } else {
    out.push(prefix.join('.'))
  }
  return out
}

export type Coerced = { ok: true; value: string | boolean } | { ok: false; reason: string }

export function coerce(schema: JsonSchema, path: string, input: unknown): Coerced {
  if (schema.type === 'boolean') {
    if (typeof input === 'boolean') return { ok: true, value: input }
    if (typeof input === 'string' && /^(true|yes|false|no)$/i.test(input)) {
      return { ok: true, value: /^(true|yes)$/i.test(input) }
    }
    return { ok: false, reason: `"${path}" expects true or false.` }
  }
  if (typeof input !== 'string' && typeof input !== 'number') {
    return { ok: false, reason: `"${path}" expects a string or number.` }
  }
  const text = String(input)
  if (schema.enum) {
    const match = schema.enum
      .map(String)
      .find((option) => option.toLowerCase() === text.toLowerCase())
    return match === undefined
      ? { ok: false, reason: `"${path}" must be one of: ${schema.enum.join(', ')}.` }
      : { ok: true, value: match }
  }
  const problem = checkLeaf(schema, text)
  if (problem) return { ok: false, reason: `"${path}": ${problem}.` }
  return { ok: true, value: text }
}