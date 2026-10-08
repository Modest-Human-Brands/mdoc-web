import { describe, expect, it } from 'vite-plus/test'

import { formatBytes } from '../format'

describe('formatBytes', () => {
  it('uses B, KB and MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(86016)).toBe('84 KB')
    expect(formatBytes(1572864)).toBe('1.5 MB')
    expect(formatBytes(-1)).toBe('')
  })
})