import { apiUrl, request, requestBlob } from './http'
import type {
  DocumentDetail,
  DocumentList,
  UpdateDocumentRequest,
  UpdateDocumentResponse,
  VoidDocumentResponse,
} from './types'

const docPath = (id: string) => `/document/${encodeURIComponent(id)}`

export const documentsApi = {
  list: (params: { limit?: number; offset?: number } = {}, signal?: AbortSignal) =>
    request<DocumentList>('/document', { query: params, signal }),

  get: (id: string, signal?: AbortSignal) => request<DocumentDetail>(docPath(id), { signal }),

  update: (id: string, body: UpdateDocumentRequest, signal?: AbortSignal) =>
    request<UpdateDocumentResponse>(docPath(id), { method: 'PATCH', body, signal }),

  /** Raw PDF, or a PNG thumbnail with `type: 'image'`. */
  content: (id: string, opts: { type?: 'image' } = {}, signal?: AbortSignal) =>
    requestBlob(`${docPath(id)}/content`, { query: opts, signal }),

  /** URL for <a download> / <iframe>; the browser fetches it directly. */
  contentUrl: (id: string, opts: { download?: boolean; type?: 'image' } = {}) => {
    const qs = new URLSearchParams()
    if (opts.download) qs.set('download', 'true')
    if (opts.type) qs.set('type', opts.type)
    const query = qs.toString()
    return apiUrl(`${docPath(id)}/content${query ? `?${query}` : ''}`)
  },

  void: (id: string, reason: string, signal?: AbortSignal) =>
    request<VoidDocumentResponse>(`${docPath(id)}/void`, {
      method: 'POST',
      body: { reason },
      signal,
    }),
}