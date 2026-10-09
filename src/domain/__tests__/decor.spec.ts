import { describe, expect, it } from 'vite-plus/test'

import { decorKind, describeDecor } from '../decor'
import { isHttpsUrl } from '../url'

describe('decor references', () => {
  it('classifies the reference formats', () => {
    expect(decorKind('')).toBe('none')
    expect(decorKind('none')).toBe('none')
    expect(decorKind('builtin:leaf')).toBe('builtin')
    expect(decorKind('upload:' + 'a'.repeat(40))).toBe('upload')
    expect(decorKind('https://example.com/a.png')).toBe('url')
  })

  it('accepts https URLs only', () => {
    expect(isHttpsUrl('https://example.com/a.png')).toBe(true)
    expect(isHttpsUrl('http://example.com/a.png')).toBe(false)
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpsUrl('not a url')).toBe(false)
  })

  it('describes a value for the review step', () => {
    expect(describeDecor('none')).toBe('')
    expect(describeDecor('builtin:leaf')).toBe('leaf')
    expect(describeDecor('upload:abc')).toBe('Uploaded image')
  })
})