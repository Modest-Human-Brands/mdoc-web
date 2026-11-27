import type { OrganizationRecord } from '@/domain/organization'

import { request } from './http'

const NOTION_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

export function isNotionId(value: string): boolean {
  return NOTION_ID.test(value.trim())
}

export function orgHeaders(organizationId: string | undefined): Record<string, string> | undefined {
  const id = organizationId?.trim()
  return id && !isNotionId(id) ? { 'x-org-id': id } : undefined
}

export const organizationApi = {
  /** The signed-in organisation as Notion holds it. */
  get: (signal?: AbortSignal) => request<OrganizationRecord>('/organization', { signal }),

  /** `revision` is the one the edits were based on; the server answers 409 if Notion moved on. */
  update: (revision: string, changes: Record<string, unknown>) =>
    request<OrganizationRecord>('/organization', {
      method: 'PATCH',
      body: { revision, ...changes },
    }),
}