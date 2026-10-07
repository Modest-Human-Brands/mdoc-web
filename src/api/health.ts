import { request } from './http'
import type { HealthResponse } from './types'

export const healthApi = {
  check: (signal?: AbortSignal) => request<HealthResponse>('/health', { signal }),
}