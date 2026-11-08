import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vite-plus'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      env: {
        VITE_MDOC_WEB_USER_ID: '',
        VITE_MDOC_WEB_CONTACT_ID: '',
        VITE_MDOC_WEB_PROJECT_ID: '',
        VITE_MDOC_WEB_SITE_URL: '',
        VITE_MDOC_WEB_API_URL: '',
        ORGANIZATION_ID: '',
      },
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)