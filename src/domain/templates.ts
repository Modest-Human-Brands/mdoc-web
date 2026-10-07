import type { TemplateSummary } from '@/api'

export type TemplateCategory = 'Billing' | 'Contract' | 'Certificate' | 'Other'

/**
 * The API exposes no category, so it is derived here. Unknown ids fall back to "Other", which
 * keeps newly registered backend templates visible without a frontend change.
 */
const CATEGORY_BY_ID: Record<string, TemplateCategory> = {
  invoice: 'Billing',
  quotation: 'Billing',
  receipt: 'Billing',
  'retainer-contract': 'Contract',
  'shoot-contract': 'Contract',
  'internship-completion-certificate': 'Certificate',
}

export function categoryOf(templateId: string): TemplateCategory {
  return CATEGORY_BY_ID[templateId] ?? 'Other'
}

/** Filter chips: "All" plus every category that has at least one template, in a stable order. */
export function categoryFilters(
  templates: TemplateSummary[],
): { id: 'All' | TemplateCategory; count: number }[] {
  const order: TemplateCategory[] = ['Billing', 'Contract', 'Certificate', 'Other']
  const counts = new Map<TemplateCategory, number>()
  for (const template of templates) {
    const category = categoryOf(template.id)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [
    { id: 'All', count: templates.length },
    ...order.filter((c) => counts.has(c)).map((c) => ({ id: c, count: counts.get(c) ?? 0 })),
  ]
}