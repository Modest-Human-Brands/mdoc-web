import { request } from './http'
import type { DecorSummary, DecorUpload } from './types'

export const decorApi = {
  list: (slot?: string, signal?: AbortSignal) =>
    request<DecorSummary[]>('/decor', { query: { slot }, signal }),

  upload: (file: File, signal?: AbortSignal) => {
    const body = new FormData()
    body.append('file', file)
    return request<DecorUpload>('/decor/upload', { method: 'POST', body, signal })
  },
}