const NOTION_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

export function isNotionId(value: string): boolean {
  return NOTION_ID.test(value.trim())
}

export function orgHeaders(organizationId: string | undefined): Record<string, string> | undefined {
  const id = organizationId?.trim()
  return id && !isNotionId(id) ? { 'x-org-id': id } : undefined
}