import { describe, expect, it } from 'vite-plus/test'

import type { TemplateSummary } from '@/api'
import templates from '@/test/fixtures/templates.json'

import { categoryFilters, categoryOf } from '../templates'

describe('categories', () => {
  it('maps known ids and falls back to Other', () => {
    expect(categoryOf('invoice')).toBe('Billing')
    expect(categoryOf('shoot-contract')).toBe('Contract')
    expect(categoryOf('brand-new-template')).toBe('Other')
  })

  it('builds filter chips from the real template list, skipping empty categories', () => {
    expect(categoryFilters(templates as TemplateSummary[])).toEqual([
      { id: 'All', count: 5 },
      { id: 'Billing', count: 2 },
      { id: 'Contract', count: 2 },
      { id: 'Certificate', count: 1 },
    ])
  })
})