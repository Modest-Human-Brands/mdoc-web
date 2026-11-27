import type { JsonSchema } from '@/api'

import { emptyValue, isObjectSchema, orderedProperties, type Values } from './schema'
import { isTermsSchema, selectedSlugs, termOptions, termTitle, withRequired } from './terms'

const isRecord = (value: unknown): value is Values =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

interface StoredTerm {
  slug?: string
  title?: string
}

/** A saved document keeps a copy of each term it used; the picker works with slugs. */
function storedTerms(value: unknown): StoredTerm[] {
  const items = isRecord(value) ? value.items : value
  if (!Array.isArray(items)) return []
  return items.map((item) => (typeof item === 'string' ? { slug: item } : (item as StoredTerm)))
}

/**
 * Turns a saved document's data back into what the form holds (the reverse of `toPayload`). Terms no longer offered
 * for the template are left out and named in `dropped`.
 */
export function toFormValues(schema: JsonSchema, saved: unknown, dropped: string[] = []): unknown {
  if (isObjectSchema(schema)) {
    const source = isRecord(saved) ? saved : {}
    return Object.fromEntries(
      orderedProperties(schema).map(([key, child]) => [
        key,
        toFormValues(child, source[key], dropped),
      ]),
    )
  }
  if (isTermsSchema(schema)) {
    const offered = new Set(termOptions(schema).map((option) => option.slug))
    const kept: string[] = []
    for (const { slug, title } of storedTerms(saved)) {
      if (slug && offered.has(slug)) kept.push(slug)
      else if (slug) dropped.push(title ?? termTitle(schema, slug))
    }
    return withRequired(selectedSlugs(kept), schema)
  }
  if (schema.type === 'array') {
    if (!Array.isArray(saved) || saved.length === 0) return emptyValue(schema)
    const { items } = schema
    return items ? saved.map((item) => toFormValues(items, item, dropped)) : saved
  }
  if (schema.type === 'boolean') return saved === true
  if (typeof saved !== 'string' && typeof saved !== 'number') return ''
  const text = String(saved)
  // A date input only accepts the day part of a timestamp.
  return schema.format === 'date' ? text.replace(/^(\d{4}-\d{2}-\d{2})T.*$/, '$1') : text
}

/** The server fills this in itself. */
const SERVER_OWNED = new Set(['organization'])

/**
 * Adds back the saved fields that have no input in the form, so editing a document made through the API does not
 * silently drop them.
 */
export function keepUnlistedFields(
  schema: JsonSchema,
  saved: unknown,
  payload: unknown,
  root = true,
): Values {
  const result: Values = isRecord(payload) ? { ...payload } : {}
  if (!isRecord(saved)) return result
  const properties = schema.properties ?? {}

  for (const [key, value] of Object.entries(saved)) {
    if (root && SERVER_OWNED.has(key)) continue
    const child = properties[key]
    if (!child) {
      // Terms are re-selected from the picker; without one, the saved copy is not ours to send back.
      if (!(root && key === 'terms')) result[key] = value
    } else if (isObjectSchema(child) && !isTermsSchema(child)) {
      const nested = keepUnlistedFields(child, value, result[key], false)
      if (Object.keys(nested).length > 0) result[key] = nested
    }
  }
  return result
}