import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, isRef, shallowRef, type Ref } from 'vue'

import PdfPage from '../PdfPage.vue'

interface UsePdfOptions {
  onError?: (error: unknown) => void
}

const pages = shallowRef(0)
const pdf = shallowRef<object | undefined>(undefined)
let capturedSource: unknown
let capturedOptions: UsePdfOptions | undefined
let loadedHandler: ((viewport: { width: number; height: number }) => void) | undefined

vi.mock('@tato30/vue-pdf', () => ({
  usePDF: (source: unknown, options?: UsePdfOptions) => {
    capturedSource = source
    capturedOptions = options
    return { pdf, pages, info: shallowRef({}) }
  },
  VuePDF: defineComponent({
    props: { pdf: { type: Object, default: undefined }, page: Number, width: Number },
    emits: ['loaded'],
    setup(props, { emit }) {
      loadedHandler = (viewport) => emit('loaded', viewport)
      return () =>
        h('div', { 'data-testid': 'vue-pdf', 'data-page': props.page, 'data-width': props.width })
    },
  }),
}))

beforeEach(() => {
  pages.value = 0
  pdf.value = {}
  capturedSource = undefined
  capturedOptions = undefined
  loadedHandler = undefined
})

describe('PdfPage', () => {
  it('feeds a reactive URL to usePDF and renders the requested page at the given width', async () => {
    const wrapper = mount(PdfPage, { props: { url: 'blob:a', page: 2, width: 520 } })
    pages.value = 3
    await flushPromises()

    expect(isRef(capturedSource)).toBe(true)
    expect((capturedSource as Ref<string>).value).toBe('blob:a')
    const view = wrapper.get('[data-testid="vue-pdf"]')
    expect(view.attributes('data-page')).toBe('2')
    expect(view.attributes('data-width')).toBe('520')

    await wrapper.setProps({ url: 'blob:b' })
    expect((capturedSource as Ref<string>).value).toBe('blob:b')
  })

  it('reports the page count once the document is loaded', async () => {
    const wrapper = mount(PdfPage, { props: { url: 'blob:a', page: 1, width: 520 } })
    expect(wrapper.emitted('pages')).toBeUndefined()

    pages.value = 2
    await flushPromises()

    expect(wrapper.emitted('pages')?.[0]).toEqual([2])
  })

  it('clamps an out-of-range page to the document', async () => {
    const wrapper = mount(PdfPage, { props: { url: 'blob:a', page: 9, width: 520 } })
    pages.value = 2
    await flushPromises()

    expect(wrapper.get('[data-testid="vue-pdf"]').attributes('data-page')).toBe('2')

    await wrapper.setProps({ page: 0 })
    expect(wrapper.get('[data-testid="vue-pdf"]').attributes('data-page')).toBe('1')
  })

  it('emits the page aspect ratio from the loaded viewport', async () => {
    const wrapper = mount(PdfPage, { props: { url: 'blob:a', page: 1, width: 520 } })
    pages.value = 1
    await flushPromises()

    loadedHandler?.({ width: 595, height: 842 })

    expect(wrapper.emitted('aspect')?.[0]?.[0]).toBeCloseTo(842 / 595)
  })

  it('reports a read failure with the library error message', async () => {
    const wrapper = mount(PdfPage, { props: { url: 'blob:bad', page: 1, width: 520 } })

    capturedOptions?.onError?.(new Error('Invalid PDF structure'))
    capturedOptions?.onError?.('weird')

    expect(wrapper.emitted('failed')).toEqual([['Invalid PDF structure'], ['Cannot read PDF']])
  })
})