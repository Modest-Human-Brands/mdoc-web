import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'

import UiFontPicker from '../UiFontPicker.vue'

const options = [
  { family: 'Exo 2', name: 'Exo2' },
  { family: 'Open Sans', name: 'OpenSans' },
]

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom has no modal dialogs.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false
  }
})
afterEach(() => vi.useRealTimers())

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(UiFontPicker, {
    props: { modelValue: 'Exo 2', label: 'Font', options, ...props },
  })
}

async function openChooser(props: Record<string, unknown> = {}) {
  const wrapper = mountPicker(props)
  await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
  return wrapper
}

const button = (wrapper: ReturnType<typeof mountPicker>, text: string) =>
  wrapper.findAll('button').find((item) => item.text() === text)!

describe('UiFontPicker', () => {
  it('loads the featured list when opened and debounces typed searches', async () => {
    const wrapper = await openChooser()
    const input = wrapper.get('input')
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
    const wrapper = await openChooser()
    const input = wrapper.get('input')

    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Open Sans'])
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('changes the font only once it is confirmed', async () => {
    const wrapper = await openChooser()

    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(wrapper.text()).toContain('Open Sans · The quick brown fox')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await button(wrapper, 'Use font').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Open Sans'])
  })

  it('keeps the value when cancelled', async () => {
    const wrapper = await openChooser()

    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    await button(wrapper, 'Cancel').trigger('click')

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('shows loading and empty states', async () => {
    const loading = await openChooser({ loading: true, options: [] })
    expect(loading.text()).toContain('Searching')

    const empty = await openChooser({ options: [] })
    expect(empty.text()).toContain('No fonts found')
  })

  it('offers the fallback when the saved font is unknown', async () => {
    const wrapper = mountPicker({ modelValue: 'Georgia', unknown: true })
    await nextTick()

    expect(wrapper.text()).toContain('Georgia')
    expect(wrapper.text()).toContain('Font unavailable')
    await button(wrapper, 'Use fallback').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Exo 2'])
  })

  it('says so when the search is unavailable', async () => {
    const wrapper = await openChooser({ offline: true })
    expect(wrapper.text()).toContain('Font search is unavailable')
  })
})