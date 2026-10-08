import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vite-plus'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      env: {
        VITE_USER_ID: '',
        VITE_CONTACT_ID: '',
        VITE_PROJECT_ID: '',
        VITE_API_BASE_URL: '',
        VITE_DEFAULT_ORGANIZATION_ID: '',
      },
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)