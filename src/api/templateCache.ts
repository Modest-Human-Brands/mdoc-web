import { templatesApi } from './templates'
import type { TemplateDetail } from './types'

const detailCache = new Map<string, TemplateDetail>()
const inflight = new Map<string, Promise<TemplateDetail>>()

export function fetchTemplateDetail(id: string): Promise<TemplateDetail> {
  const cached = detailCache.get(id)
  if (cached) return Promise.resolve(cached)
  const pending = inflight.get(id)
  if (pending) return pending

  const request = templatesApi
    .get(id)
    .then((loaded) => {
      detailCache.set(id, loaded)
      return loaded
    })
    .finally(() => inflight.delete(id))
  inflight.set(id, request)
  return request
}

export function clearTemplateCache(): void {
  detailCache.clear()
  inflight.clear()
}