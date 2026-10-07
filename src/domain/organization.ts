/**
 * The server owns branding: it resolves it from `organizationId` (a preset such as
 * `modest-human-brands`). There is no API to read or write an organisation yet, so this profile is
 * only cached on this device. It does NOT change the generated PDF.
 */

export const ENTITY_TYPES = ['LLP', 'Private Limited', 'Proprietorship'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export interface OrganizationProfile {
  /** Preset id sent to the API as `organizationId`. */
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

export const DEFAULT_ORGANIZATION_ID: string =
  import.meta.env.VITE_DEFAULT_ORGANIZATION_ID ?? 'modest-human-brands'

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
  } catch {
    // Storage unavailable (private mode / quota): the profile lives in memory for this session.
  }
}