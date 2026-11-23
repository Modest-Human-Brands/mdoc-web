import { describe, expect, it } from 'vite-plus/test'

import { levelFor, setLevel, setScope, termScope } from '../terms'

const none = { appliesTo: [], defaultFor: [], requiredFor: [] }
const all = ['quotation', 'invoice']

describe('term levels per template', () => {
  it('reads one level per template', () => {
    const lists = {
      appliesTo: ['quotation', 'invoice'],
      defaultFor: ['quotation'],
      requiredFor: [],
    }
    expect(levelFor(lists, 'quotation')).toBe('default')
    expect(levelFor(lists, 'invoice')).toBe('available')
    expect(levelFor({ ...lists, appliesTo: ['quotation'] }, 'invoice')).toBe('off')
    expect(levelFor(none, 'invoice')).toBe('available')
  })

  it('required implies default, and default can be stepped back down', () => {
    const required = setLevel(none, 'invoice', 'required')
    expect(required.requiredFor).toEqual(['invoice'])
    expect(required.defaultFor).toEqual(['invoice'])
    const down = setLevel(required, 'invoice', 'available')
    expect(down.requiredFor).toEqual([])
    expect(down.defaultFor).toEqual([])
  })

  it('off removes a template from every list when restricted', () => {
    const lists = setScope(setLevel(none, 'invoice', 'required'), 'selected', all)
    const off = setLevel(lists, 'invoice', 'off')
    expect(off).toEqual({ appliesTo: ['quotation'], defaultFor: [], requiredFor: [] })
  })

  it('cannot switch off in any-template mode or turn off the last template', () => {
    expect(setLevel(none, 'invoice', 'off')).toBe(none)
    const one = { appliesTo: ['invoice'], defaultFor: [], requiredFor: [] }
    expect(setLevel(one, 'invoice', 'off')).toBe(one)
  })

  it('switches scope without losing defaults', () => {
    const lists = setLevel(none, 'invoice', 'default')
    const selected = setScope(lists, 'selected', all)
    expect(termScope(selected)).toBe('selected')
    expect(selected.defaultFor).toEqual(['invoice'])
    expect(setScope(selected, 'any', all).appliesTo).toEqual([])
  })
})