import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'

import UiButton from '../UiButton.vue'
import UiDocToolbar from '../UiDocToolbar.vue'
import UiSegmentedControl from '../UiSegmentedControl.vue'
import UiStepper from '../UiStepper.vue'
import UiTextField from '../UiTextField.vue'

describe('UiButton', () => {
  it('renders the slot and uses the primary fill by default', () => {
    const wrapper = mount(UiButton, { slots: { default: 'Continue' } })

    expect(wrapper.text()).toBe('Continue')
    expect(wrapper.classes()).toContain('bg-accent-500')
  })

  it('looks disabled and blocks clicks when disabled', async () => {
    const wrapper = mount(UiButton, { props: { disabled: true } })

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.classes()).toContain('text-light-400')
  })
})

describe('UiTextField', () => {
  it('links the label to the input and updates the model', async () => {
    const wrapper = mount(UiTextField, {
      props: {
        label: 'Business name',
        modelValue: '',
        'onUpdate:modelValue': (value: string | undefined) =>
          wrapper.setProps({ modelValue: value }),
      },
    })

    const input = wrapper.get('input')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))

    await input.setValue('Red Cat')
    expect(wrapper.props('modelValue')).toBe('Red Cat')
  })

  it('renders a textarea when multiline and is read-only when asked', () => {
    const wrapper = mount(UiTextField, {
      props: { label: 'Message', multiline: true, readonly: true },
    })

    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.get('textarea').attributes('readonly')).toBeDefined()
  })
})

describe('UiStepper', () => {
  it('marks done steps, the current step and upcoming steps', () => {
    const wrapper = mount(UiStepper, {
      props: { steps: ['Template', 'Brand', 'Details', 'Send'], current: 1 },
    })
    const labels = wrapper.findAll('li span:last-child').map((node) => node.text())

    expect(labels).toEqual(['✓  Template', '2 Brand', '3 Details', '4 Send'])
    expect(wrapper.find('[aria-current="step"]').text()).toBe('2 Brand')
  })
})

describe('UiSegmentedControl', () => {
  it('selects an option on click', async () => {
    const wrapper = mount(UiSegmentedControl, {
      props: {
        label: 'Pricing',
        modelValue: 'project',
        options: [
          { value: 'project', label: 'Per project' },
          { value: 'day', label: 'Per day' },
        ],
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    })

    await wrapper.findAll('[role="radio"]')[1]?.trigger('click')

    expect(wrapper.props('modelValue')).toBe('day')
  })
})

describe('UiDocToolbar', () => {
  it('clamps zoom between 50% and 200%', async () => {
    const wrapper = mount(UiDocToolbar, {
      props: {
        zoom: 190,
        'onUpdate:zoom': (value: number | undefined) => wrapper.setProps({ zoom: value }),
      },
    })

    await wrapper.get('[aria-label="Zoom in"]').trigger('click')
    expect(wrapper.props('zoom')).toBe(200)
    expect(wrapper.get('[aria-label="Zoom in"]').attributes('disabled')).toBeDefined()
  })

  it('emits download', async () => {
    const wrapper = mount(UiDocToolbar)

    await wrapper.get('[aria-label="Download"]').trigger('click')

    expect(wrapper.emitted('download')).toHaveLength(1)
  })
})