import { loadAccess } from '@/domain/access'

export interface RuntimeConfig {
  apiBaseUrl?: string
  siteUrl?: string
  organizationId?: string
  userId?: string
  contactId?: string
  projectId?: string
  apiKey?: string
}

declare global {
  interface Window {
    __MDOC_CONFIG__?: RuntimeConfig
  }
}

export function pickConfig(...values: (string | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return ''
}

export type BuildConfig = RuntimeConfig

function buildConfig(): BuildConfig {
  return {
    apiBaseUrl: import.meta.env.DEV ? undefined : import.meta.env.VITE_MDOC_WEB_API_URL,
    siteUrl: import.meta.env.VITE_MDOC_WEB_SITE_URL,
    organizationId: import.meta.env.ORGANIZATION_ID,
    userId: import.meta.env.DEV ? import.meta.env.VITE_MDOC_WEB_USER_ID : undefined,
    contactId: import.meta.env.DEV ? import.meta.env.VITE_MDOC_WEB_CONTACT_ID : undefined,
    projectId: import.meta.env.DEV ? import.meta.env.VITE_MDOC_WEB_PROJECT_ID : undefined,
    apiKey: import.meta.env.DEV ? import.meta.env.VITE_MDOC_WEB_API_KEY : undefined,
  }
}

export function readConfig(
  runtime: RuntimeConfig | undefined = typeof window === 'undefined'
    ? undefined
    : window.__MDOC_CONFIG__,
  build: BuildConfig = buildConfig(),
  saved: Pick<RuntimeConfig, 'organizationId' | 'userId' | 'apiKey'> = {},
) {
  return {
    apiBaseUrl: pickConfig(runtime?.apiBaseUrl, build.apiBaseUrl),
    siteUrl: pickConfig(runtime?.siteUrl, build.siteUrl),
    organizationId: pickConfig(saved.organizationId, runtime?.organizationId, build.organizationId),
    userId: pickConfig(saved.userId, runtime?.userId, build.userId),
    contactId: pickConfig(runtime?.contactId, build.contactId),
    projectId: pickConfig(runtime?.projectId, build.projectId),
    apiKey: pickConfig(saved.apiKey, runtime?.apiKey, build.apiKey),
  }
}

function readSaved() {
  const access = loadAccess()
  return { organizationId: access.organizationId, userId: access.userId, apiKey: access.apiKey }
}

export const config = readConfig(undefined, undefined, readSaved())