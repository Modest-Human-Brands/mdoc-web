export interface RuntimeConfig {
  apiBaseUrl?: string
  siteUrl?: string
  organizationId?: string
  userId?: string
  contactId?: string
  projectId?: string
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
    apiBaseUrl: import.meta.env.DEV ? undefined : import.meta.env.VITE_MDOC_API_URL,
    siteUrl: import.meta.env.VITE_PUBLIC_SITE_URL,
    organizationId: import.meta.env.VITE_DEFAULT_ORGANIZATION_ID,
    userId: import.meta.env.DEV ? import.meta.env.VITE_MDOC_USER_ID : undefined,
    contactId: import.meta.env.DEV ? import.meta.env.VITE_MDOC_CONTACT_ID : undefined,
    projectId: import.meta.env.DEV ? import.meta.env.VITE_MDOC_PROJECT_ID : undefined,
  }
}

export function readConfig(
  runtime: RuntimeConfig | undefined = typeof window === 'undefined'
    ? undefined
    : window.__MDOC_CONFIG__,
  build: BuildConfig = buildConfig(),
) {
  return {
    apiBaseUrl: pickConfig(runtime?.apiBaseUrl, build.apiBaseUrl),
    siteUrl: pickConfig(runtime?.siteUrl, build.siteUrl),
    organizationId: pickConfig(runtime?.organizationId, build.organizationId),
    userId: pickConfig(runtime?.userId, build.userId),
    contactId: pickConfig(runtime?.contactId, build.contactId),
    projectId: pickConfig(runtime?.projectId, build.projectId),
  }
}

export const config = readConfig()