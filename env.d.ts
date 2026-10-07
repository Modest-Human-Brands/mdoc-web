/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the MDoc API. Defaults to the same-origin `/api` proxy. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}