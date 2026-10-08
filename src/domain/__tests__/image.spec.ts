import { describe, expect, it } from 'vite-plus/test'

import { fitWithin, LOGO_MAX_SIDE } from '../image'

describe('fitWithin', () => {
  it('scales the longer side down to the maximum, keeping the aspect ratio', () => {
    expect(fitWithin(1024, 512)).toEqual({ width: 256, height: 128 })
    expect(fitWithin(300, 600, 100)).toEqual({ width: 50, height: 100 })
  })

  it('never enlarges a small image', () => {
    expect(fitWithin(64, 32)).toEqual({ width: 64, height: 32 })
  })

  it('falls back to a square for images without intrinsic size (e.g. some SVGs)', () => {
    expect(fitWithin(0, 0)).toEqual({ width: LOGO_MAX_SIDE, height: LOGO_MAX_SIDE })
    expect(fitWithin(Number.NaN, 10)).toEqual({ width: LOGO_MAX_SIDE, height: LOGO_MAX_SIDE })
  })

  it('keeps at least one pixel on a very thin image', () => {
    expect(fitWithin(5000, 1)).toEqual({ width: 256, height: 1 })
  })
})