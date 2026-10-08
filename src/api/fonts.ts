import { request } from './http'
import type { FontSummary } from './types'

export const fontsApi = {
  list: (query: { q?: string; limit?: number } = {}, signal?: AbortSignal) =>
    request<FontSummary[]>('/fonts', { query, signal }),
}