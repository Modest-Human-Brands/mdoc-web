import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent } from 'vue'

import { clearTemplateCache } from '@/api'
import { useWizardStore } from '@/stores/wizard'

import { useActiveTemplate } from '../useTemplates'

const replace = vi.fn<(to: string) => Promise<void>>(() => Promise.resolve())

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace }),
}))

const Probe = defineComponent({
  setup() {
    useActiveTemplate()
    return () => null
  },
})

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

describe('useActiveTemplate', () => {
  beforeEach(() => {
    localStorage.clear()
    clearTemplateCache()
    replace.mockClear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drops a selection whose template no longer exists and returns to the template step', async () => {
    stubFetch(404, { statusMessage: "Template 'gone' not found." })
    const wizard = useWizardStore()
    wizard.selectTemplate('gone')

    mount(Probe)
    await flushPromises()

    expect(wizard.templateId).toBeNull()
    expect(replace).toHaveBeenCalledWith('/new/template')
  })

  it('keeps the selection and reports other failures instead of loading forever', async () => {
    stubFetch(500, { statusMessage: 'Boom' })
    const wizard = useWizardStore()
    wizard.selectTemplate('invoice')

    mount(Probe)
    await flushPromises()

    expect(wizard.templateId).toBe('invoice')
    expect(wizard.templateError).toBe('Boom')
    expect(replace).not.toHaveBeenCalled()
  })
})