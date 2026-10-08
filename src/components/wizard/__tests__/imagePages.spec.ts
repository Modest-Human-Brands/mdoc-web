import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'

import ImagePages from '../ImagePages.vue'

const pages = [
  { url: '/api/document/template/invoice/sample/1.png?v=abc', width: 1191, height: 1684 },
  { url: '/api/document/template/invoice/sample/2.png?v=abc', width: 1191, height: 1684 },
]

describe('ImagePages', () => {
  it('renders one image per page, sized to the requested width', () => {
    const wrapper = mount(ImagePages, { props: { pages, width: 520 } })

    const images = wrapper.findAll('img')
    expect(images).toHaveLength(2)
    expect(images[0]?.attributes('src')).toBe(pages[0]?.url)
    expect(images[0]?.attributes('style')).toContain('width: 520px')
    expect(wrapper.findAll('[data-page]').map((el) => el.attributes('data-page'))).toEqual([
      '1',
      '2',
    ])
  })

  it('reports the page count and the aspect ratio from the manifest, without loading anything', () => {
    const wrapper = mount(ImagePages, { props: { pages, width: 520 } })

    expect(wrapper.emitted('pages')?.[0]).toEqual([2])
    expect(wrapper.emitted('aspect')?.[0]?.[0]).toBeCloseTo(1684 / 1191)
  })
})