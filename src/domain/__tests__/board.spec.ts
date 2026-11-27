import { describe, expect, it } from 'vite-plus/test'

import { boardColumn, formatAgo, groupByColumn } from '../documents'

describe('board', () => {
  it('maps backend statuses onto columns', () => {
    expect(boardColumn('Plan')).toBe('Draft')
    expect(boardColumn('Delivered')).toBe('Sent')
    expect(boardColumn('Completed')).toBe('Signed')
    expect(boardColumn('Partially Signed')).toBe('Partially Signed')
    expect(boardColumn('Void')).toBe('Void')
  })

  it('always lists the five stages and adds Void only when needed', () => {
    const empty = groupByColumn([])
    expect(empty.map((g) => g.column)).toEqual([
      'Draft',
      'Ready',
      'Sent',
      'Partially Signed',
      'Signed',
    ])
    const withVoid = groupByColumn([{ status: 'Void' }, { status: 'Ready' }])
    expect(withVoid[withVoid.length - 1]?.column).toBe('Void')
    expect(withVoid.find((g) => g.column === 'Ready')?.items).toHaveLength(1)
  })

  it('formats relative time', () => {
    const now = Date.parse('2026-01-10T12:00:00Z')
    expect(formatAgo('2026-01-10T10:00:00Z', now)).toBe('2h ago')
    expect(formatAgo('2026-01-09T12:00:00Z', now)).toBe('1d ago')
    expect(formatAgo('2025-12-20T12:00:00Z', now)).toBe('3w ago')
    expect(formatAgo(undefined, now)).toBe('')
  })
})