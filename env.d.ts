/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />
/// <reference types="unplugin-fonts/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEFAULT_ORGANIZATION_ID?: string
  readonly VITE_USER_ID?: string
  readonly VITE_CONTACT_ID?: string
  readonly VITE_PROJECT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}