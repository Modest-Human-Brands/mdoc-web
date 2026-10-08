import { config } from '@/config'

export const ENTITY_TYPES = ['LLP', 'Private Limited', 'Proprietorship'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export interface OrganizationProfile {
  id: string
  name: string
  legalName: string
  entityType: EntityType
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
}

export const FONT_IDS: Record<string, string> = { 'Exo 2': 'Exo2' }
export const FONTS = ['Exo 2'] as const

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
    pan: '',
    gstin: '',
    logo: null,
    primary: '#111827',
    accent: '#5945EA',
    font: 'Exo 2',
    bank: { accountName: '', accountNumber: '', bankName: '', ifscCode: '' },
    contactEmail: '',
    billingEmail: '',
    phone: '',
  }
}

const KEY = 'mdoc.organization'

export function loadOrganization(): OrganizationProfile {
  const base = emptyOrganization()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<OrganizationProfile>
    return { ...base, ...saved, bank: { ...base.bank, ...saved.bank } }
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
  if (profile.entityType !== defaults.entityType) override.entityType = profile.entityType

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
  const font = FONT_IDS[profile.font]
  if (font && profile.font !== defaults.font) branding.font = font
  if (Object.keys(branding).length > 0) override.branding = branding

  return Object.keys(override).length > 0 ? { id: profile.id, ...override } : null
}