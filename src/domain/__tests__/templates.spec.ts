import { describe, expect, it } from 'vite-plus/test'

import type { TemplateSummary } from '@/api'
import templates from '@/test/fixtures/templates.json'

import { categoryFilters } from '../templates'

describe('categoryFilters', () => {
  it('builds chips from the categories the server reports (real template list)', () => {
    expect(categoryFilters(templates as TemplateSummary[])).toEqual([
      { id: 'All', count: 5 },
      { id: 'Contracts', count: 2 },
      { id: 'Certificates', count: 1 },
      { id: 'Billing', count: 2 },
    ])
  })

  it('shows only All when there are no templates', () => {
    expect(categoryFilters([])).toEqual([{ id: 'All', count: 0 }])
  })

  it('picks up a category the frontend has never heard of', () => {
    const extra = { ...(templates[0] as TemplateSummary), id: 'new', category: 'Legal' }

    expect(categoryFilters([extra]).map((c) => c.id)).toEqual(['All', 'Legal'])
  })
})