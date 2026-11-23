import type { JsonSchema, TermOption } from '@/api'

export function isTermsSchema(schema: JsonSchema): boolean {
  return schema.type === 'terms'
}

function slugs(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function termOptions(schema: JsonSchema): TermOption[] {
  return Array.isArray(schema.options) ? schema.options : []
}

export function requiredTerms(schema: JsonSchema): string[] {
  return slugs(schema.required)
}

/** Defaults in order, then any required term the defaults leave out; unknown slugs are dropped. */
export function termDefaults(schema: JsonSchema): string[] {
  const known = new Set(termOptions(schema).map((option) => option.slug))
  return withRequired(
    slugs(schema.default).filter((slug) => known.has(slug)),
    schema,
  )
}

/** Keeps the order given, drops duplicates and appends missing required terms at the end. */
export function withRequired(selection: readonly string[], schema: JsonSchema): string[] {
  const result = [...new Set(selection)]
  for (const slug of requiredTerms(schema)) if (!result.includes(slug)) result.push(slug)
  return result
}

export function termTitle(schema: JsonSchema, slug: string): string {
  return termOptions(schema).find((option) => option.slug === slug)?.title ?? slug
}

export function isLocked(schema: JsonSchema, slug: string): boolean {
  return requiredTerms(schema).includes(slug)
}

export function addTerm(selection: readonly string[], slug: string): string[] {
  return selection.includes(slug) ? [...selection] : [...selection, slug]
}

export function removeTerm(
  selection: readonly string[],
  slug: string,
  schema: JsonSchema,
): string[] {
  return isLocked(schema, slug) ? [...selection] : selection.filter((item) => item !== slug)
}

export function moveTerm(selection: readonly string[], from: number, to: number): string[] {
  const result = [...selection]
  if (from < 0 || from >= result.length || to < 0 || to >= result.length || from === to) {
    return result
  }
  const [item] = result.splice(from, 1)
  if (item !== undefined) result.splice(to, 0, item)
  return result
}

export function availableTerms(schema: JsonSchema, selection: readonly string[]): TermOption[] {
  return termOptions(schema).filter((option) => !selection.includes(option.slug))
}

export function missingTerms(schema: JsonSchema, selection: unknown): string[] {
  const chosen = slugs(selection)
  return requiredTerms(schema).filter((slug) => !chosen.includes(slug))
}

export function selectedSlugs(value: unknown): string[] {
  return slugs(value)
}