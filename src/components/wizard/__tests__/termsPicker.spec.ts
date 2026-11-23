import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'

import type { JsonSchema } from '@/api'

import TermsPicker from '../TermsPicker.vue'

const schema: JsonSchema = {
  type: 'terms',
  options: [
    { slug: 'payment', title: 'Payment' },
    { slug: 'cancellation', title: 'Cancellation' },
    { slug: 'law', title: 'Governing law' },
  ],
  required: ['law'],
}

function lastEmitted(wrapper: ReturnType<typeof mount>) {
  const events = wrapper.emitted('update:modelValue') ?? []
  return events[events.length - 1]?.[0]
}

describe('TermsPicker', () => {
  it('lists the selection in order and offers the rest to add', () => {
    const wrapper = mount(TermsPicker, { props: { schema, modelValue: ['law', 'payment'] } })

    expect(wrapper.findAll('ol li').map((li) => li.text())).toEqual([
      expect.stringContaining('Governing law'),
      expect.stringContaining('Payment'),
    ])
    expect(wrapper.find('[aria-label="Available terms"]').text()).toBe('Cancellation')
  })

  it('locks a required term: no remove button, still reorderable', () => {
    const wrapper = mount(TermsPicker, { props: { schema, modelValue: ['payment', 'law'] } })

    expect(wrapper.find('[aria-label="Remove Governing law"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Remove Payment"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Required')
  })

  it('emits the new order when a term moves, is removed or is added', async () => {
    const wrapper = mount(TermsPicker, { props: { schema, modelValue: ['payment', 'law'] } })

    await wrapper.find('[aria-label="Move Governing law up"]').trigger('click')
    expect(lastEmitted(wrapper)).toEqual(['law', 'payment'])

    await wrapper.find('[aria-label="Remove Payment"]').trigger('click')
    expect(lastEmitted(wrapper)).toEqual(['law'])

    await wrapper.find('[aria-label="Available terms"] button').trigger('click')
    expect(lastEmitted(wrapper)).toEqual(['payment', 'law', 'cancellation'])
  })

  it('disables moving the first term up and the last term down', () => {
    const wrapper = mount(TermsPicker, { props: { schema, modelValue: ['payment', 'law'] } })

    expect(wrapper.find('[aria-label="Move Payment up"]').attributes('disabled')).toBeDefined()
    expect(
      wrapper.find('[aria-label="Move Governing law down"]').attributes('disabled'),
    ).toBeDefined()
  })
})