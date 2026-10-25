import { request } from './http'
import { orgHeaders } from './organization'
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  PreviewRequest,
  PreviewResponse,
  TemplateDetail,
  TemplateSummary,
} from './types'

export const templatesApi = {
  list: (signal?: AbortSignal) => request<TemplateSummary[]>('/document/template', { signal }),

  get: (id: string, signal?: AbortSignal) =>
    request<TemplateDetail>(`/document/template/${encodeURIComponent(id)}`, { signal }),

  preview: (body: PreviewRequest, options: { draft?: boolean; signal?: AbortSignal } = {}) =>
    request<PreviewResponse>('/document/template/preview', {
      method: 'POST',
      query: options.draft ? { draft: true } : undefined,
      body,
      signal: options.signal,
    }),

  createDocument: (body: CreateDocumentRequest, signal?: AbortSignal) => {
    const { organizationId, ...rest } = body
    const preset = orgHeaders(organizationId)
    const payload = organizationId && !preset ? body : rest
    return request<CreateDocumentResponse>('/document/template', {
      method: 'POST',
      body: payload,
      headers: preset,
      signal,
    })
  },
}