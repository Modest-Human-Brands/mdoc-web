import { config } from '@/config'

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
  bank: { accountName: string; accountNumber: string; bankName: string; ifscCode: string }
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
    bank: { accountName: '', accountNumber: '', bankName: '', ifscCode: '' },
    contactEmail: '',
    billingEmail: '',
    phone: '',
    whatsapp: '',
    website: '',
    socials: { instagram: '', facebook: '', linkedin: '', youtube: '' },
  }
}

const KEY = 'mdoc.organization'

export function loadOrganization(): OrganizationProfile {
  const base = emptyOrganization()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<OrganizationProfile>
    return {
      ...base,
      ...saved,
      bank: { ...base.bank, ...saved.bank },
      socials: { ...base.socials, ...saved.socials },
    }
  } catch {
    return base
  }
}

export function saveOrganization(profile: OrganizationProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile))
  } catch {}
}

export function toOrganizationOverride(
  profile: OrganizationProfile,
): Record<string, unknown> | null {
  const defaults = emptyOrganization()
  const override: Record<string, unknown> = {}

  const text = (key: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed !== '') override[key] = trimmed
  }
  text('name', profile.name)
  text('legalName', profile.legalName)
  text('pan', profile.pan)
  text('gstin', profile.gstin)
  text('contactEmail', profile.contactEmail)
  text('billingEmail', profile.billingEmail)
  text('phone', profile.phone)
  text('whatsapp', profile.whatsapp)
  text('website', profile.website)
  text('address', profile.address)
  if (profile.entityType !== defaults.entityType) override.entityType = profile.entityType
  if (profile.tradeRelationship !== defaults.tradeRelationship) {
    override.tradeRelationship = profile.tradeRelationship
  }
  const year = Number.parseInt(profile.foundedYear, 10)
  if (profile.foundedYear.trim() !== '' && Number.isSafeInteger(year)) override.foundedYear = year

  const socials: Record<string, string> = {}
  for (const key of SOCIAL_KEYS) {
    const link = profile.socials[key].trim()
    if (link !== '') socials[key] = link
  }
  if (Object.keys(socials).length > 0) override.socials = socials

  const bank: Record<string, unknown> = {}
  const { accountName, accountNumber, bankName, ifscCode } = profile.bank
  if (accountName.trim()) bank.accountName = accountName.trim()
  if (bankName.trim()) bank.bankName = bankName.trim()
  if (ifscCode.trim()) bank.ifscCode = ifscCode.trim()
  const digits = accountNumber.replace(/\D/g, '')
  if (digits !== '' && Number.isSafeInteger(Number(digits))) bank.accountNumber = Number(digits)
  if (Object.keys(bank).length > 0) override.accountDetails = bank

  const branding: Record<string, unknown> = {}
  if (profile.logo) branding.logo = profile.logo.dataUrl
  const primary = normalizeHex(profile.primary)
  const accent = normalizeHex(profile.accent)
  const color: Record<string, string> = {}
  if (primary && primary !== normalizeHex(defaults.primary)) color.primary = primary
  if (accent && accent !== normalizeHex(defaults.accent)) color.accent = accent
  if (Object.keys(color).length > 0) branding.color = color
  const family = profile.font.trim()
  if (family !== '' && family !== defaults.font) branding.font = fontName(family)
  if (Object.keys(branding).length > 0) override.branding = branding

  return Object.keys(override).length > 0 ? { id: profile.id, ...override } : null
}