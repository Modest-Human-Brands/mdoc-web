import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import UiFontPicker from '../UiFontPicker.vue'

const options = [
  { family: 'Exo 2', name: 'Exo2' },
  { family: 'Open Sans', name: 'OpenSans' },
]

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(UiFontPicker, {
    props: { modelValue: 'Exo 2', label: 'Font', options, ...props },
  })
}

describe('UiFontPicker', () => {
  it('loads the featured list when opened and debounces typed searches', async () => {
    const wrapper = mountPicker()
    const input = wrapper.get('input')

    await input.trigger('focus')
    expect(wrapper.emitted('search')).toEqual([['']])

    await input.setValue('o')
    await input.setValue('op')
    await input.setValue('open')
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.emitted('search')).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(100)
    expect(wrapper.emitted('search')).toEqual([[''], ['open']])
  })

  it('moves with the arrow keys and picks with Enter', async () => {
    const wrapper = mountPicker()
    const input = wrapper.get('input')

    await input.trigger('focus')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Open Sans'])
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('closes on Escape without changing the value', async () => {
    const wrapper = mountPicker()
    const input = wrapper.get('input')

    await input.trigger('focus')
    await input.trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('shows loading and empty states', async () => {
    const loading = mountPicker({ loading: true, options: [] })
    await loading.get('input').trigger('focus')
    expect(loading.text()).toContain('Searching')

    const empty = mountPicker({ options: [] })
    await empty.get('input').trigger('focus')
    expect(empty.text()).toContain('No fonts found')
  })

  it('keeps a saved font as the current value and explains the fallback', () => {
    const wrapper = mountPicker({ modelValue: 'Georgia', unknown: true })

    expect(wrapper.get('input').element.value).toBe('Georgia')
    expect(wrapper.text()).toContain('will use Exo 2')
  })

  it('says so when the search is unavailable', () => {
    expect(mountPicker({ offline: true }).text()).toContain('Font search is unavailable')
  })
})