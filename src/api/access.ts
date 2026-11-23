import type { Access } from '@/domain/access'

import { DEFAULT_ORGANIZATION_ID } from '@/domain/organization'

import { ApiError, request } from './http'
import { orgHeaders } from './organization'

/**
 * Checks the entered details against the server before they are saved: one cheap
 * authenticated read, sent with the typed key rather than the configured one.
 */
export async function verifyAccess(access: Access, signal?: AbortSignal): Promise<void> {
  try {
    await request('/document', {
      query: { limit: 1 },
      headers: {
        'x-api-key': access.apiKey.trim(),
        'x-org-id': access.organizationId.trim() || DEFAULT_ORGANIZATION_ID,
        'x-user-id': access.userId.trim(),
        ...orgHeaders(access.organizationId),
      },
      signal,
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, 'The server rejected this API key. Check it and try again.')
    }
    throw error
  }
}