import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vite-plus/test'

import UiColorField from '../UiColorField.vue'

function mountField(value: string) {
  const wrapper = mount(UiColorField, {
    props: {
      label: 'Primary',
      modelValue: value,
      'onUpdate:modelValue': (next: string | undefined) => wrapper.setProps({ modelValue: next }),
    },
  })
  return wrapper
}

describe('UiColorField', () => {
  it('shows no error for a valid colour', () => {
    const wrapper = mountField('#5945EA')

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('input[maxlength]').attributes('aria-invalid')).toBeUndefined()
  })

  it('flags text that is not a hex colour and explains the format', () => {
    const wrapper = mountField('notacolor')

    expect(wrapper.get('[role="alert"]').text()).toBe('Use a hex colour like #5945EA')
    expect(wrapper.get('input[maxlength]').attributes('aria-invalid')).toBe('true')
  })

  it('expands shorthand and fixes the case when the field loses focus', async () => {
    const wrapper = mountField('#abc')

    await wrapper.get('input[maxlength]').trigger('blur')

    expect(wrapper.props('modelValue')).toBe('#AABBCC')
  })

  it('does not complain about an empty field', () => {
    expect(mountField('').find('[role="alert"]').exists()).toBe(false)
  })
})