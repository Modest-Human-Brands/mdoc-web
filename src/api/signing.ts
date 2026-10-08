import { request } from './http'
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  PrepareSigningRequest,
  PrepareSigningResponse,
  SignResponse,
  VerifySessionResponse,
  VerifySignatureResponse,
} from './types'

const docPath = (id: string) => `/document/${encodeURIComponent(id)}`

export const signingApi = {
  createSession: (id: string, body: CreateSessionRequest, signal?: AbortSignal) =>
    request<CreateSessionResponse>(`${docPath(id)}/session`, { method: 'POST', body, signal }),

  verifySession: (id: string, sessionToken: string, signal?: AbortSignal) =>
    request<VerifySessionResponse>(`${docPath(id)}/session/verify`, {
      method: 'POST',
      body: { sessionToken },
      signal,
    }),

  prepare: (id: string, body: PrepareSigningRequest, signal?: AbortSignal) =>
    request<PrepareSigningResponse>(`${docPath(id)}/sign/prepare`, {
      method: 'POST',
      body,
      signal,
    }),

  signOnClient: (id: string, sessionId: string, signatureHex: string, signal?: AbortSignal) =>
    request<SignResponse>(`${docPath(id)}/sign/client`, {
      method: 'POST',
      body: { sessionId, signatureHex },
      signal,
    }),

  signOnServer: (id: string, sessionId: string, signal?: AbortSignal) =>
    request<SignResponse>(`${docPath(id)}/sign/server`, {
      method: 'POST',
      body: { sessionId },
      signal,
    }),

  verifySignature: (id: string, pdf: Blob, signal?: AbortSignal) => {
    const form = new FormData()
    form.append('pdf', pdf)
    return request<VerifySignatureResponse>(`${docPath(id)}/sign/verify`, {
      method: 'POST',
      body: form,
      signal,
    })
  },
}