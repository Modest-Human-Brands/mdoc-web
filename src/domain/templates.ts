import type { TemplateSummary } from '@/api'

export function categoryFilters(templates: TemplateSummary[]): { id: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const template of templates) {
    counts.set(template.category, (counts.get(template.category) ?? 0) + 1)
  }
  return [
    { id: 'All', count: templates.length },
    ...[...counts].map(([id, count]) => ({ id, count })),
  ]
}