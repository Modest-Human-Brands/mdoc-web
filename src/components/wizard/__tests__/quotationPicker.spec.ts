import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'

import { documentsApi } from '@/api'

import QuotationPicker from '../QuotationPicker.vue'

describe('QuotationPicker', () => {
  it('offers "No quotation", which clears the number and reports it', async () => {
    vi.spyOn(documentsApi, 'list').mockResolvedValue({
      results: [{ id: 'q1', name: 'MHB-Q-26-009', status: 'Draft' }],
    } as Awaited<ReturnType<typeof documentsApi.list>>)
    const wrapper = mount(QuotationPicker, { props: { modelValue: 'MHB-Q-26-009' } })
    await flushPromises()

    expect(wrapper.findAll('option').map((option) => option.text())).toEqual(
      expect.arrayContaining(['No quotation', 'Enter the number myself']),
    )
    await wrapper.get('select').setValue('__none')

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(wrapper.emitted('cleared')).toHaveLength(1)
  })
})