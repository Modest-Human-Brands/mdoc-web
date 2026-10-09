import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'

import { recentDecor, rememberDecor } from '../useRecentDecor'

beforeEach(() => {
  localStorage.clear()
  recentDecor.value = []
})

describe('recent uploads', () => {
  it('keeps the newest first, without duplicates, capped at 8', () => {
    for (let i = 0; i < 10; i++) rememberDecor({ id: `upload:${i}`, url: `/u/${i}.png` })
    rememberDecor({ id: 'upload:5', url: '/u/5.png' })

    expect(recentDecor.value).toHaveLength(8)
    expect(recentDecor.value[0]?.id).toBe('upload:5')
    expect(recentDecor.value.filter((item) => item.id === 'upload:5')).toHaveLength(1)
  })

  it('persists to localStorage and starts empty from corrupt storage', async () => {
    rememberDecor({ id: 'upload:a', url: '/u/a.png' })
    await nextTick()
    expect(JSON.parse(localStorage.getItem('mdoc.decor.recent') ?? '[]')).toEqual([
      { id: 'upload:a', url: '/u/a.png' },
    ])

    vi.resetModules()
    localStorage.setItem('mdoc.decor.recent', '{oops')
    const fresh = await import('../useRecentDecor')
    expect(fresh.recentDecor.value).toEqual([])
  })
})