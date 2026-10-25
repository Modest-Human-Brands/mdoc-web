import { config } from '@/config'

export interface FieldError {
  field: string
  message: string
  code?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly fields: FieldError[]

  constructor(status: number, message: string, fields: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

const baseUrl = config.apiBaseUrl.replace(/\/+$/, '')

export function apiUrl(path: string): string {
  return `${baseUrl}/api${path}`
}

export function resolveApiUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${baseUrl}${path}`
}

type Query = Record<string, string | number | boolean | undefined>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  query?: Query
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

function withQuery(url: string, query?: Query): string {
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

interface ErrorBody {
  statusMessage?: string
  message?: string
  data?: { errors?: FieldError[] }
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || `Request failed (${response.status})`
  let fields: FieldError[] = []
  try {
    const data = (await response.json()) as ErrorBody
    fields = (data.data?.errors ?? []).filter((e) => typeof e.field === 'string')
    const first = fields[0]
    if (first) {
      message = fields.length > 1 ? `${first.message} (+${fields.length - 1} more)` : first.message
    } else {
      const detail = data.statusMessage ?? data.message
      if (detail) message = detail
    }
  } catch {}
  if (response.status === 401) {
    message = 'The server rejected this app’s API key. Check the frontend configuration.'
  }
  return new ApiError(response.status, message, fields)
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', query, body, signal } = options
  const isForm = body instanceof FormData
  const headers: Record<string, string> = { ...options.headers }
  if (config.apiKey) headers['x-api-key'] = config.apiKey
  const init: RequestInit = { method, signal, headers }
  if (body !== undefined) {
    init.body = isForm ? body : JSON.stringify(body)
    if (!isForm) headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(withQuery(apiUrl(path), query), init)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }
  if (!response.ok) throw await toApiError(response)
  return response
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options)
  return (await response.json()) as T
}

export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await send(path, options)
  return await response.blob()
}