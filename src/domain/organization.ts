import { config } from '@/config'

import { defaultQrStyle, normalizeQrStyle, type QrStyle } from './qr'

export const ENTITY_TYPES = ['LLP', 'Private Limited', 'Proprietorship'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export const TRADE_RELATIONSHIPS = [
  'Primary',
  'Trading As',
  'Operating Division',
  'Wholly-Owned Subsidiary',
  'Special Purpose Vehicle',
] as const
export type TradeRelationship = (typeof TRADE_RELATIONSHIPS)[number]

export const SOCIAL_KEYS = ['instagram', 'facebook', 'linkedin', 'youtube'] as const
export type SocialKey = (typeof SOCIAL_KEYS)[number]

export const FIRST_FOUNDED_YEAR = 1900

export interface OrganizationProfile {
  id: string
  name: string
  legalName: string
  entityType: EntityType
  tradeRelationship: TradeRelationship
  address: string
  foundedYear: string
  pan: string
  gstin: string
  logo: { name: string; dataUrl: string } | null
  primary: string
  accent: string
  font: string
  bank: {
    accountName: string
    accountNumber: string
    bankName: string
    ifscCode: string
    upiId: string
  }
  qr: QrStyle
  contactEmail: string
  billingEmail: string
  phone: string
  whatsapp: string
  website: string
  socials: Record<SocialKey, string>
}

export const DEFAULT_FONT = 'Exo 2'

export function fontName(family: string): string {
  return family.replace(/\s+/g, '')
}

export function normalizeHex(input: string): string | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!match) return null
  const hex = match[1] ?? ''
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  return `#${full.toUpperCase()}`
}

export function foundedYearError(input: string): string | null {
  const text = input.trim()
  if (text === '') return null
  const year = Number(text)
  const valid =
    /^\d{4}$/.test(text) && year >= FIRST_FOUNDED_YEAR && year <= new Date().getFullYear()
  return valid ? null : `Enter a year between ${FIRST_FOUNDED_YEAR} and this year`
}

export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(input.trim())
}

export const DEFAULT_ORGANIZATION_ID: string = config.organizationId || 'modest-human-brands'

export function emptyOrganization(): OrganizationProfile {
  return {
    id: DEFAULT_ORGANIZATION_ID,
    name: '',
    legalName: '',
    entityType: 'LLP',
    tradeRelationship: 'Primary',
    address: '',
    foundedYear: '',
    pan: '',
    gstin: '',
    logo: null,
    primary: '#111827',
    accent: '#5945EA',
    font: DEFAULT_FONT,
    bank: { accountName: '', accountNumber: '', bankName: '', ifscCode: '', upiId: '' },
    qr: { ...defaultQrStyle },
    contactEmail: '',
    billingEmail: '',
    phone: '',
    whatsapp: '',
    website: '',
    socials: { instagram: '', facebook: '', linkedin: '', youtube: '' },
  }
}

/** The organisation as the API returns it from Notion. */
export interface StoredOrganization {
  id: string
  name: string
  contactEmail?: string
  legalName?: string
  entityType?: string
  tradeRelationship?: string
  gstin?: string
  pan?: string
  address?: string
  foundedYear?: number
  accountDetails?: Partial<Record<keyof OrganizationProfile['bank'], string | number>>
  branding: {
    logo?: string
    qr?: Record<string, unknown>
    color: { primary: string; accent: string }
    font: string
  }
  website?: string
  phone?: string
  whatsapp?: string
  billingEmail?: string
  socials?: Record<string, string>
}

export interface OrganizationRecord {
  pageId: string
  revision: string
  organization: StoredOrganization
}

export const STORED_LOGO_NAME = 'Logo saved in Notion'

/** Notion stores a font without spaces (`PlayfairDisplay`); the picker shows the family name. */
export function fontFamily(name: string): string {
  return name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/([a-z])([A-Z0-9])/g, '$1 $2')
}

export function fromStoredOrganization(stored: StoredOrganization): OrganizationProfile {
  const base = emptyOrganization()
  const { branding, accountDetails, socials } = stored
  const oneOf = <T extends string>(options: readonly T[], value: string | undefined, other: T) =>
    options.find((option) => option === value) ?? other
  const bank = { ...base.bank }
  for (const key of Object.keys(bank) as (keyof typeof bank)[]) {
    bank[key] = String(accountDetails?.[key] ?? '')
  }
  const links = { ...base.socials }
  for (const key of SOCIAL_KEYS) links[key] = socials?.[key] ?? ''

  return {
    id: stored.id,
    name: stored.name,
    legalName: stored.legalName ?? '',
    entityType: oneOf(ENTITY_TYPES, stored.entityType, base.entityType),
    tradeRelationship: oneOf(TRADE_RELATIONSHIPS, stored.tradeRelationship, base.tradeRelationship),
    address: stored.address ?? '',
    foundedYear: stored.foundedYear === undefined ? '' : String(stored.foundedYear),
    pan: stored.pan ?? '',
    gstin: stored.gstin ?? '',
    logo: branding.logo ? { name: STORED_LOGO_NAME, dataUrl: branding.logo } : null,
    primary: branding.color.primary,
    accent: branding.color.accent,
    font: fontFamily(branding.font),
    bank,
    qr: normalizeQrStyle(branding.qr),
    contactEmail: stored.contactEmail ?? '',
    billingEmail: stored.billingEmail ?? '',
    phone: stored.phone ?? '',
    whatsapp: stored.whatsapp ?? '',
    website: stored.website ?? '',
    socials: links,
  }
}

const TEXT_FIELDS = [
  'name',
  'legalName',
  'address',
  'pan',
  'gstin',
  'contactEmail',
  'billingEmail',
  'phone',
  'whatsapp',
  'website',
] as const

function changedText<K extends string>(
  keys: readonly K[],
  before: Record<K, string>,
  after: Record<K, string>,
): Partial<Record<K, string>> {
  const changes: Partial<Record<K, string>> = {}
  for (const key of keys) {
    if (after[key].trim() !== before[key].trim()) changes[key] = after[key].trim()
  }
  return changes
}

const yearOf = (input: string) => {
  const year = Number.parseInt(input, 10)
  return Number.isSafeInteger(year) ? year : null
}

/**
 * Only what differs from the loaded record, so a save never rewrites a field nobody touched. An empty string (or
 * `null`) clears a field in Notion.
 */
export function toOrganizationPatch(
  before: OrganizationProfile,
  after: OrganizationProfile,
): Record<string, unknown> {
  const patch: Record<string, unknown> = changedText(TEXT_FIELDS, before, after)

  if (after.entityType !== before.entityType) patch.entityType = after.entityType
  if (after.tradeRelationship !== before.tradeRelationship) {
    patch.tradeRelationship = after.tradeRelationship
  }
  if (yearOf(after.foundedYear) !== yearOf(before.foundedYear)) {
    patch.foundedYear = yearOf(after.foundedYear)
  }

  const bankKeys = Object.keys(after.bank) as (keyof OrganizationProfile['bank'])[]
  const bank = changedText(bankKeys, before.bank, after.bank)
  if (bank.accountNumber !== undefined) {
    bank.accountNumber = bank.accountNumber.replace(/\s/g, '')
  }
  if (Object.keys(bank).length > 0) patch.accountDetails = bank

  const socials = changedText(SOCIAL_KEYS, before.socials, after.socials)
  if (Object.keys(socials).length > 0) patch.socials = socials

  const branding: Record<string, unknown> = {}
  if ((after.logo?.dataUrl ?? '') !== (before.logo?.dataUrl ?? '')) {
    branding.logo = after.logo?.dataUrl ?? ''
  }
  const color: Record<string, string> = {}
  for (const key of ['primary', 'accent'] as const) {
    const next = normalizeHex(after[key])
    if (next && next !== normalizeHex(before[key])) color[key] = next
  }
  if (Object.keys(color).length > 0) branding.color = color
  if (fontName(after.font.trim()) !== fontName(before.font.trim())) {
    branding.font = fontName(after.font.trim())
  }
  const qr: Record<string, unknown> = {}
  for (const key of Object.keys(defaultQrStyle) as (keyof QrStyle)[]) {
    if (after.qr[key] !== before.qr[key]) qr[key] = after.qr[key]
  }
  if (Object.keys(qr).length > 0) branding.qr = qr
  if (Object.keys(branding).length > 0) patch.branding = branding

  return patch
}

/** The whole form in the shape templates render, used to preview edits that are not saved yet. */
export function toPreviewOrganization(profile: OrganizationProfile): Record<string, unknown> {
  const defaults = emptyOrganization()
  const preview: Record<string, unknown> = {
    id: profile.id,
    name: profile.name.trim(),
    entityType: profile.entityType,
    tradeRelationship: profile.tradeRelationship,
  }

  for (const key of TEXT_FIELDS) {
    const value = profile[key].trim()
    if (value !== '') preview[key] = value
  }
  const year = yearOf(profile.foundedYear)
  if (year !== null) preview.foundedYear = year

  const filled = (values: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(values)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value !== ''),
    )
  const bank = filled(profile.bank)
  if (Object.keys(bank).length > 0) preview.accountDetails = bank
  const socials = filled(profile.socials)
  if (Object.keys(socials).length > 0) preview.socials = socials

  preview.branding = {
    ...(profile.logo ? { logo: profile.logo.dataUrl } : {}),
    color: {
      primary: normalizeHex(profile.primary) ?? defaults.primary,
      accent: normalizeHex(profile.accent) ?? defaults.accent,
    },
    qr: { ...profile.qr },
    font: fontName(profile.font.trim() || defaults.font),
  }

  return preview
}