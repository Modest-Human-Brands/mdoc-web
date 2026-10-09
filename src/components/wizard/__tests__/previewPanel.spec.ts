import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'

import { lastShown } from '@/composables/previewStage'

import PreviewPanel from '../PreviewPanel.vue'

const aspectEmitters = new Map<string, () => void>()

vi.mock('../PdfDocument.vue', () => ({
  __esModule: true,
  default: defineComponent({
    props: { url: String, width: Number },
    emits: ['pages', 'aspect', 'failed'],
    setup(props, { emit }) {
      aspectEmitters.set(props.url ?? '', () => emit('aspect', 1.41))
      return () =>
        h('div', { 'data-testid': 'pdf', 'data-url': props.url }, [
          h('canvas', { width: 520, height: 735 }),
        ])
    },
  }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  aspectEmitters.clear()
  lastShown.value = null
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,SNAP')
})

afterEach(() => vi.restoreAllMocks())

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
    const [oldLayer, newLayer] = wrapper.findAll('[data-layer]')
    expect(oldLayer?.classes()).toContain('blur-[3px]')
    expect(newLayer?.classes()).toContain('opacity-0')

    aspectEmitters.get('blob:two')?.()
    await flushPromises()
    expect(urls(wrapper)).toEqual(['blob:two'])
    expect(wrapper.get('[data-newest]').classes()).toContain('opacity-100')
  })

  it('shows nothing and no spinner without a source', async () => {
    const wrapper = mount(PreviewPanel, { props: { label: 'Preview', url: null } })
    await flushPromises()

    expect(wrapper.find('[data-testid="preview-stage"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Updating')
  })

  it('starts from the preview on screen before it, so the step change blurs instead of going blank', async () => {
    const first = mount(PreviewPanel, { props: { label: 'Preview', url: 'blob:step-one' } })
    await vi.dynamicImportSettled()
    await flushPromises()
    aspectEmitters.get('blob:step-one')?.()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(700)
    first.unmount()

    const next = mount(PreviewPanel, { props: { label: 'Preview', url: null } })
    await flushPromises()
    expect(next.text()).not.toContain('Nothing to preview')
    expect(next.findAll('img').map((img) => img.attributes('src'))).toEqual([
      'data:image/jpeg;base64,SNAP',
    ])

    await next.setProps({ url: 'blob:step-two' })
    await vi.dynamicImportSettled()
    await flushPromises()
    expect(urls(next)).toEqual(['blob:step-two'])
    aspectEmitters.get('blob:step-two')?.()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(900)
    expect(next.findAll('img')).toHaveLength(0)
    expect(urls(next)).toEqual(['blob:step-two'])
  })

  it('keeps the drawn pages as images when the step ends, so the next step never goes blank', async () => {
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    const wrapper = mount(PreviewPanel, { props: { label: 'Preview', url: 'blob:drawn' } })
    await vi.dynamicImportSettled()
    await flushPromises()
    aspectEmitters.get('blob:drawn')?.()
    await flushPromises()

    wrapper.unmount()
    expect(toDataURL).toHaveBeenCalled()
    expect(lastShown.value?.pages?.[0]?.url).toBe('data:image/jpeg;base64,SNAP')
  })
})