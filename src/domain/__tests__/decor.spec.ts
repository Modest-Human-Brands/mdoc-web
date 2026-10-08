import { beforeEach, describe, expect, it } from 'vite-plus/test'

import { decorKind, describeDecor, loadRecentDecor, rememberDecor } from '../decor'
import { isHttpsUrl } from '../url'

beforeEach(() => localStorage.clear())

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

describe('recent uploads', () => {
  it('keeps the newest first, without duplicates, capped at 8', () => {
    for (let i = 0; i < 10; i++) rememberDecor({ id: `upload:${i}`, url: `/u/${i}.png` })
    rememberDecor({ id: 'upload:5', url: '/u/5.png' })

    const recent = loadRecentDecor()

    expect(recent).toHaveLength(8)
    expect(recent[0]?.id).toBe('upload:5')
    expect(recent.filter((item) => item.id === 'upload:5')).toHaveLength(1)
  })

  it('ignores corrupt storage', () => {
    localStorage.setItem('mdoc.decor.recent', '{oops')
    expect(loadRecentDecor()).toEqual([])
  })
})