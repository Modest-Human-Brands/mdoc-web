/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />
/// <reference types="unplugin-fonts/client" />

interface ImportMetaEnv {
  readonly VITE_MDOC_WEB_SITE_URL?: string
  readonly VITE_MDOC_WEB_API_URL?: string
  readonly ORGANIZATION_ID?: string
  readonly VITE_MDOC_WEB_USER_ID?: string
  readonly VITE_MDOC_WEB_CONTACT_ID?: string
  readonly VITE_MDOC_WEB_PROJECT_ID?: string
  readonly VITE_MDOC_WEB_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}