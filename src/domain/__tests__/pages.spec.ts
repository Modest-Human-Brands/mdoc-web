import { describe, expect, it } from 'vite-plus/test'

import { mostVisiblePage } from '../pages'

const pages = [
  { top: 12, bottom: 712 },
  { top: 728, bottom: 1428 },
]

describe('mostVisiblePage', () => {
  it('is page 1 at the top of the scroll', () => {
    expect(mostVisiblePage(pages, 0, 600)).toBe(1)
  })

  it('switches to the page that fills more of the view while scrolling between pages', () => {
    expect(mostVisiblePage(shift(pages, -300), 0, 600)).toBe(1)
    expect(mostVisiblePage(shift(pages, -500), 0, 600)).toBe(2)
  })

  it('is page 2 at the bottom', () => {
    expect(mostVisiblePage(shift(pages, -828), 0, 600)).toBe(2)
  })

  it('prefers the earlier page on a tie and falls back to 1 when nothing is laid out', () => {
    expect(
      mostVisiblePage(
        [
          { top: 0, bottom: 100 },
          { top: 100, bottom: 200 },
        ],
        50,
        150,
      ),
    ).toBe(1)
    expect(mostVisiblePage([], 0, 600)).toBe(1)
    expect(mostVisiblePage([{ top: 900, bottom: 1000 }], 0, 600)).toBe(1)
  })
})

function shift(boxes: typeof pages, dy: number) {
  return boxes.map((b) => ({ top: b.top + dy, bottom: b.bottom + dy }))
}