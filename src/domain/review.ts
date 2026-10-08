import type { JsonSchema } from '@/api'

import { describeDecor } from './decor'
import { formatDate } from './invoice'
import type { OrganizationProfile } from './organization'
import {
  getPath,
  isNumeric,
  isBlankRow,
  isObjectSchema,
  labelFromPath,
  orderedProperties,
  singularLabel,
  stripExcluded,
  type Values,
} from './schema'

export interface ReviewRow {
  label: string
  value: string
}

export interface ReviewSection {
  title: string
  rows: ReviewRow[]
}

const amount = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatReviewValue(node: JsonSchema, value: unknown): string {
  if (node.type === 'boolean') {
    if (typeof value !== 'boolean') return ''
    if (/percent/i.test(node.title ?? '')) return value ? 'Percentage' : 'Flat amount'
    return value ? 'Yes' : 'No'
  }
  const text =
    typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
  if (text === '') return ''
  if (node['x-widget']) return describeDecor(text)
  if (node.format === 'date') return formatDate(text) || text
  if (isNumeric(node)) {
    const parsed = Number.parseFloat(text.replace(/,/g, ''))
    return Number.isFinite(parsed) ? amount.format(parsed) : text
  }
  if (node.enum) return capitalise(text)
  return text
}

function titleOf(node: JsonSchema, key: string): string {
  return node['x-section'] ?? node.title ?? labelFromPath(key)
}

function collect(
  node: JsonSchema,
  values: unknown,
  title: string,
  sections: ReviewSection[],
): void {
  const current: ReviewSection = { title, rows: [] }
  sections.push(current)

  for (const [key, child] of orderedProperties(node)) {
    const value = getPath(values, [key])
    if (isObjectSchema(child)) {
      collect(child, value, titleOf(child, key), sections)
    } else if (child.type === 'array') {
      collectArray(child, value, titleOf(child, key), sections, title)
    } else {
      const text = formatReviewValue(child, value)
      if (text !== '') current.rows.push({ label: child.title ?? labelFromPath(key), value: text })
    }
  }
}

function collectArray(
  node: JsonSchema,
  values: unknown,
  title: string,
  sections: ReviewSection[],
  parentTitle?: string,
): void {
  const items = node.items
  const rows = Array.isArray(values) ? values : []
  if (!items) return

  if (isObjectSchema(items)) {
    const noun = singularLabel(title)
    rows.forEach((row, index) => {
      if (isBlankRow(items, row)) return
      const before = sections.length
      collect(items, row, `${noun} ${index + 1}`, sections)
      const own = sections[before]
      if (own && own.rows.length === 0 && sections.length === before + 1) sections.pop()
    })
    return
  }

  const texts = rows.map((row) => formatReviewValue(items, row)).filter((text) => text !== '')
  if (texts.length === 0) return
  const noun = singularLabel(title)
  sections.push({
    title: parentTitle ? `${parentTitle} · ${title}` : title,
    rows: texts.map((value, index) => ({ label: `${noun} ${index + 1}`, value })),
  })
}

export function buildReview(schema: JsonSchema, values: Values): ReviewSection[] {
  const sections: ReviewSection[] = []
  const root = stripExcluded(schema)

  const scalars: ReviewRow[] = []
  for (const [key, child] of orderedProperties(root)) {
    const value = getPath(values, [key])
    if (isObjectSchema(child)) {
      collect(child, value, titleOf(child, key), sections)
    } else if (child.type === 'array') {
      collectArray(child, value, titleOf(child, key), sections)
    } else {
      const text = formatReviewValue(child, value)
      if (text !== '') scalars.push({ label: child.title ?? labelFromPath(key), value: text })
    }
  }
  if (scalars.length > 0) sections.push({ title: 'Details', rows: scalars })

  return sections.filter((section) => section.rows.length > 0)
}

export function organizationReview(profile: OrganizationProfile): ReviewSection {
  const rows: ReviewRow[] = []
  const add = (label: string, value: string) => {
    if (value.trim() !== '') rows.push({ label, value: value.trim() })
  }
  add('Business name', profile.name)
  add('Legal name', profile.legalName)
  add('Address', profile.address)
  add('PAN', profile.pan)
  add('GSTIN', profile.gstin)
  add('Bank', [profile.bank.bankName, profile.bank.accountName].filter(Boolean).join(' · '))
  add('Contact', [profile.contactEmail, profile.phone].filter(Boolean).join(' · '))
  add('Website', profile.website)
  add('Social', Object.values(profile.socials).filter(Boolean).join(' · '))
  if (rows.length === 0) rows.push({ label: 'Organisation', value: profile.id })
  return { title: 'Brand', rows }
}