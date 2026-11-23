import { request } from './http'
import type {
  CreateTermRequest,
  SaveTermResponse,
  TemplateDefaults,
  TermDetail,
  TermListParams,
  TermMeta,
  UpdateTermRequest,
} from './types'

const termPath = (slug: string) => `/compliance/${encodeURIComponent(slug)}`

function list<T extends Partial<TermMeta>>(raw: T[] | null | undefined): TermMeta[] {
  return (Array.isArray(raw) ? raw : []).map((item) => withLists(item))
}

/** Old rows have empty multi-selects: no template restriction and no default. */
export function withLists<T extends Partial<TermMeta>>(item: T): TermMeta & T {
  return {
    ...item,
    appliesTo: Array.isArray(item.appliesTo) ? item.appliesTo : [],
    defaultFor: Array.isArray(item.defaultFor) ? item.defaultFor : [],
    requiredFor: Array.isArray(item.requiredFor) ? item.requiredFor : [],
    version: typeof item.version === 'number' ? item.version : 1,
    order: typeof item.order === 'number' ? item.order : 0,
  } as TermMeta & T
}

export const termsApi = {
  list: async (params: TermListParams = {}, signal?: AbortSignal) =>
    list(await request<TermMeta[]>('/compliance', { query: { ...params }, signal })),

  get: async (slug: string, signal?: AbortSignal) =>
    withLists(await request<TermDetail>(termPath(slug), { signal })),

  create: async (body: CreateTermRequest, signal?: AbortSignal) => {
    const response = await request<{ doc: TermMeta }>('/compliance', {
      method: 'POST',
      body,
      signal,
    })
    return withLists(response.doc)
  },

  updateMeta: async (slug: string, body: UpdateTermRequest, signal?: AbortSignal) =>
    withLists(await request<TermMeta>(termPath(slug), { method: 'PATCH', body, signal })),

  saveContent: (slug: string, content: unknown, signal?: AbortSignal) =>
    request<SaveTermResponse>(termPath(slug), { method: 'PUT', body: { content }, signal }),

  archive: async (slug: string, signal?: AbortSignal) =>
    withLists(await request<TermMeta>(termPath(slug), { method: 'DELETE', signal })),

  setDefaults: (templateId: string, slugs: string[], signal?: AbortSignal) =>
    request<TemplateDefaults>(`/compliance/defaults/${encodeURIComponent(templateId)}`, {
      method: 'PUT',
      body: { slugs },
      signal,
    }),
}