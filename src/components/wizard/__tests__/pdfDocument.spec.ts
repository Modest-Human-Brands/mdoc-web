import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, shallowRef } from 'vue'

import PdfDocument from '../PdfDocument.vue'

interface UsePdfOptions {
  onError?: (error: unknown) => void
}

const pages = shallowRef(0)
const pdf = shallowRef<object | undefined>({})
let usePdfCalls = 0
let capturedOptions: UsePdfOptions | undefined
const loaded: ((viewport: { width: number; height: number }) => void)[] = []

vi.mock('@tato30/vue-pdf', () => ({
  usePDF: (_source: unknown, options?: UsePdfOptions) => {
    usePdfCalls++
    capturedOptions = options
    return { pdf, pages, info: shallowRef({}) }
  },
  VuePDF: defineComponent({
    props: { pdf: { type: Object, default: undefined }, page: Number, width: Number },
    emits: ['loaded'],
    setup(props, { emit }) {
      loaded[props.page ?? 0] = (viewport) => emit('loaded', viewport)
      return () => h('canvas', { 'data-testid': 'vue-pdf', 'data-page': props.page })
    },
  }),
}))

beforeEach(() => {
  pages.value = 0
  usePdfCalls = 0
  capturedOptions = undefined
  loaded.length = 0
})

describe('PdfDocument', () => {
  it('loads the document once and renders every page in order', async () => {
    const wrapper = mount(PdfDocument, { props: { url: 'blob:a', width: 520 } })
    pages.value = 3
    await flushPromises()

    expect(usePdfCalls).toBe(1)
    const rendered = wrapper.findAll('[data-page]').filter((el) => el.element.tagName === 'DIV')
    expect(rendered.map((el) => el.attributes('data-page'))).toEqual(['1', '2', '3'])
    expect(wrapper.findAll('[data-testid="vue-pdf"]')).toHaveLength(3)
  })

  it('renders nothing until the page count is known, then reports it', async () => {
    const wrapper = mount(PdfDocument, { props: { url: 'blob:a', width: 520 } })
    expect(wrapper.findAll('[data-testid="vue-pdf"]')).toHaveLength(0)
    expect(wrapper.emitted('pages')).toBeUndefined()

    pages.value = 2
    await flushPromises()

    expect(wrapper.emitted('pages')?.[0]).toEqual([2])
  })

  it('takes the aspect ratio from the first page only', async () => {
    const wrapper = mount(PdfDocument, { props: { url: 'blob:a', width: 520 } })
    pages.value = 2
    await flushPromises()

    loaded[2]?.({ width: 100, height: 100 })
    expect(wrapper.emitted('aspect')).toBeUndefined()

    loaded[1]?.({ width: 595, height: 842 })
    expect(wrapper.emitted('aspect')?.[0]?.[0]).toBeCloseTo(842 / 595)
  })

  it('reports a read failure', () => {
    const wrapper = mount(PdfDocument, { props: { url: 'blob:bad', width: 520 } })

    capturedOptions?.onError?.(new Error('Invalid PDF structure'))

    expect(wrapper.emitted('failed')).toEqual([['Invalid PDF structure']])
  })
})