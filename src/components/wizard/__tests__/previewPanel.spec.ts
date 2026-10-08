import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'

import PreviewPanel from '../PreviewPanel.vue'

const aspectEmitters = new Map<string, () => void>()

vi.mock('../PdfDocument.vue', () => ({
  __esModule: true,
  default: defineComponent({
    props: { url: String, width: Number },
    emits: ['pages', 'aspect', 'failed'],
    setup(props, { emit }) {
      aspectEmitters.set(props.url ?? '', () => emit('aspect', 1.41))
      return () => h('div', { 'data-testid': 'pdf', 'data-url': props.url })
    },
  }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  aspectEmitters.clear()
})

function urls(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="pdf"]').map((el) => el.attributes('data-url'))
}

describe('PreviewPanel crossfade', () => {
  it('keeps the previous render, blurred, until the new one has drawn, then drops it', async () => {
    const wrapper = mount(PreviewPanel, { props: { label: 'Preview', url: 'blob:one' } })
    await vi.dynamicImportSettled()
    await flushPromises()
    aspectEmitters.get('blob:one')?.()
    await flushPromises()
    expect(urls(wrapper)).toEqual(['blob:one'])

    await wrapper.setProps({ url: 'blob:two' })
    await vi.dynamicImportSettled()
    await flushPromises()

    expect(urls(wrapper)).toEqual(['blob:one', 'blob:two'])
    const [oldLayer, newLayer] = wrapper.findAll('[data-testid="preview-stage"] > div > div')
    expect(oldLayer?.classes()).toContain('blur-[3px]')
    expect(newLayer?.classes()).toContain('opacity-0')

    aspectEmitters.get('blob:two')?.()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="preview-stage"] > div > div')[0]?.classes()).toContain(
      'opacity-0',
    )
    expect(wrapper.findAll('[data-testid="preview-stage"] > div > div')[1]?.classes()).toContain(
      'opacity-100',
    )

    await vi.advanceTimersByTimeAsync(700)
    expect(urls(wrapper)).toEqual(['blob:two'])
  })

  it('shows nothing and no spinner without a source', async () => {
    const wrapper = mount(PreviewPanel, { props: { label: 'Preview', url: null } })
    await flushPromises()

    expect(wrapper.find('[data-testid="preview-stage"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Updating')
  })
})