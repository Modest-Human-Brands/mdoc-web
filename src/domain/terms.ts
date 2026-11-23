import type { JsonSchema, TermMeta, TermOption } from '@/api'

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
export const TERM_TEMPLATES = [
  { id: 'quotation', label: 'Quotation' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'retainer-contract', label: 'Retainer contract' },
  { id: 'shoot-contract', label: 'Shoot contract' },
  { id: 'appointment-confirmation', label: 'Appointment confirmation' },
] as const

export const TERM_STATUSES = ['Plan', 'Draft', 'Release', 'Archive'] as const

export function templateLabel(id: string): string {
  return TERM_TEMPLATES.find((template) => template.id === id)?.label ?? id
}

/** Applies To empty means any template. */
export function appliesToTemplate(term: Pick<TermMeta, 'appliesTo'>, templateId: string): boolean {
  return term.appliesTo.length === 0 || term.appliesTo.includes(templateId)
}

export function listLabels(ids: readonly string[], empty = '—'): string {
  return ids.length === 0 ? empty : ids.map(templateLabel).join(', ')
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

export interface TermLists {
  appliesTo: string[]
  defaultFor: string[]
  requiredFor: string[]
}

/** A required term is always a default; a template that is not applied to drops out of both. */
export function reconcileLists(lists: TermLists): TermLists {
  const appliesTo = [...new Set(lists.appliesTo)]
  const restricted = appliesTo.length > 0
  const allowed = (id: string) => !restricted || appliesTo.includes(id)
  const requiredFor = [...new Set(lists.requiredFor)].filter(allowed)
  const defaultFor = [...new Set([...lists.defaultFor, ...requiredFor])].filter(allowed)
  return { appliesTo, defaultFor, requiredFor }
}

export type TermLevel = 'off' | 'available' | 'default' | 'required'

export const TERM_LEVELS: readonly { id: TermLevel; label: string; hint: string }[] = [
  { id: 'off', label: 'Off', hint: 'Not offered on this template' },
  { id: 'available', label: 'Available', hint: 'Can be added when creating a document' },
  { id: 'default', label: 'Default', hint: 'Pre-selected, can be removed' },
  { id: 'required', label: 'Required', hint: 'Always included' },
]

export type TermScope = 'any' | 'selected'

export const termScope = (lists: TermLists): TermScope =>
  lists.appliesTo.length === 0 ? 'any' : 'selected'

/** One state per template instead of three overlapping checkbox lists. */
export function levelFor(lists: TermLists, templateId: string): TermLevel {
  if (lists.requiredFor.includes(templateId)) return 'required'
  if (lists.defaultFor.includes(templateId)) return 'default'
  if (termScope(lists) === 'any' || lists.appliesTo.includes(templateId)) return 'available'
  return 'off'
}

export function setLevel(lists: TermLists, templateId: string, level: TermLevel): TermLists {
  const without = (list: readonly string[]) => list.filter((id) => id !== templateId)
  const restricted = termScope(lists) === 'selected'
  if (level === 'off' && !restricted) return lists
  // Switching off the last template would silently turn into "any template".
  if (level === 'off' && lists.appliesTo.every((id) => id === templateId)) return lists
  return reconcileLists({
    appliesTo:
      restricted && level !== 'off'
        ? [...without(lists.appliesTo), templateId]
        : without(lists.appliesTo),
    defaultFor:
      level === 'default' ? [...without(lists.defaultFor), templateId] : without(lists.defaultFor),
    requiredFor:
      level === 'required'
        ? [...without(lists.requiredFor), templateId]
        : without(lists.requiredFor),
  })
}

/** "Any template" clears the restriction; "selected" starts from every template and lets the user switch some off. */
export function setScope(
  lists: TermLists,
  scope: TermScope,
  allTemplateIds: readonly string[],
): TermLists {
  if (scope === termScope(lists)) return lists
  return scope === 'any'
    ? { ...lists, appliesTo: [] }
    : reconcileLists({ ...lists, appliesTo: [...allTemplateIds] })
}

export function toggleId(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

/** Descriptor for the default-set editor: Release terms usable on the template. */
export function defaultSetSchema(terms: readonly TermMeta[], templateId: string): JsonSchema {
  const usable = terms
    .filter((term) => term.status === 'Release' && appliesToTemplate(term, templateId))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  return {
    type: 'terms',
    multiple: true,
    options: usable.map((term) => ({
      slug: term.slug,
      title: term.title,
      type: term.type,
      version: term.version,
      order: term.order,
    })),
    default: usable.filter((term) => term.defaultFor.includes(templateId)).map((t) => t.slug),
    required: usable.filter((term) => term.requiredFor.includes(templateId)).map((t) => t.slug),
  }
}

export function termStatusTone(status: string): string {
  if (status === 'Release') return 'text-success-400'
  if (status === 'Archive') return 'text-alert-400'
  return 'text-light-500'
}