import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'

import TemplateThumb from '../TemplateThumb.vue'

let emitAspect: (() => void) | undefined
let emitFailed: (() => void) | undefined

vi.mock('../PdfPage.vue', () => ({
  __esModule: true,
  default: defineComponent({
    props: { url: String, page: Number, width: Number },
    emits: ['aspect', 'failed'],
    setup(props, { emit }) {
      emitAspect = () => emit('aspect', 1.41)
      emitFailed = () => emit('failed', 'boom')
      return () =>
        h('div', { 'data-testid': 'pdf', 'data-url': props.url, 'data-width': props.width })
    },
  }),
}))

type Callback = (entries: { isIntersecting: boolean }[]) => void
let trigger: Callback | undefined

beforeEach(() => {
  trigger = undefined
  emitAspect = undefined
  emitFailed = undefined
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: Callback) {
        trigger = callback
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TemplateThumb', () => {
  it('shows the placeholder icon and does not load the PDF until it scrolls into view', async () => {
    const wrapper = mount(TemplateThumb, { props: { url: '/api/x/sample.pdf' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="pdf"]').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('loads page 1 once visible, then swaps the icon for the page when it is drawn', async () => {
    const wrapper = mount(TemplateThumb, { props: { url: '/api/x/sample.pdf' } })
    await flushPromises()
    trigger?.([{ isIntersecting: true }])
    await vi.waitFor(() => expect(wrapper.find('[data-testid="pdf"]').exists()).toBe(true))

    const pdf = wrapper.get('[data-testid="pdf"]')
    expect(pdf.attributes('data-url')).toBe('/api/x/sample.pdf')
    expect(pdf.attributes('data-width')).toBe('120')
    expect(wrapper.find('svg').exists()).toBe(true)

    emitAspect?.()
    await flushPromises()
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('falls back to the icon if the sample PDF cannot be read', async () => {
    const wrapper = mount(TemplateThumb, { props: { url: '/api/x/sample.pdf' } })
    await flushPromises()
    trigger?.([{ isIntersecting: true }])
    await vi.waitFor(() => expect(wrapper.find('[data-testid="pdf"]').exists()).toBe(true))

    emitFailed?.()
    await flushPromises()

    expect(wrapper.find('[data-testid="pdf"]').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('shows the static image and never loads the PDF when the server provides one', async () => {
    const wrapper = mount(TemplateThumb, {
      props: { url: '/api/x/sample.pdf', imageUrl: '/api/x/sample/1.png?v=abc' },
    })
    await flushPromises()
    trigger?.([{ isIntersecting: true }])
    await flushPromises()

    expect(wrapper.get('img').attributes('src')).toBe('/api/x/sample/1.png?v=abc')
    expect(wrapper.find('[data-testid="pdf"]').exists()).toBe(false)
  })

  it('falls back to the PDF when the image cannot be loaded', async () => {
    const wrapper = mount(TemplateThumb, {
      props: { url: '/api/x/sample.pdf', imageUrl: '/api/x/sample/1.png' },
    })
    await wrapper.get('img').trigger('error')
    trigger?.([{ isIntersecting: true }])
    await vi.waitFor(() => expect(wrapper.find('[data-testid="pdf"]').exists()).toBe(true))
  })
})