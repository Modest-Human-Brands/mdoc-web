export interface HealthResponse {
  status: 'OK'
  version?: string | null
  buildTime?: string | null
  node: string
}

export interface TemplateSummary {
  id: string
  label: string
  shortLabel: string
  category: string
  description: string
  sampleUrl: string
  thumbnailUrl: string | null
  pageCount: number
  version: string
  pages: TemplatePage[]
}

export interface TemplatePage {
  url: string
  width: number
  height: number
}

export type TemplateVariables = { [key: string]: string | TemplateVariables }

export type SignerFieldType =
  | 'SIGNATURE'
  | 'INITIALS'
  | 'DATE'
  | 'TEXT'
  | 'NAME'
  | 'EMAIL'
  | 'CHECKBOX'

export interface SignerField {
  id: string
  type: SignerFieldType
  signerOrder: number
  pageIndex?: number | string | number[]
  x: number
  y: number
  width: number
  height: number
  required?: boolean
}

export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'
  title?: string
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: (string | number)[]
  format?: string
  minimum?: number
  maximum?: number
  default?: unknown
  'x-auto'?: boolean
  minLength?: number
  maxLength?: number
  pattern?: string
  'x-section'?: string
  'x-column'?: number
  'x-order'?: number
  'x-widget'?: 'decor' | 'image'
  'x-decor-slot'?: string
}

export interface TemplateDetail extends TemplateSummary {
  schema: JsonSchema
  variables: TemplateVariables
  signerFields: SignerField[]
}

export type PreviewVariant = 'sample' | 'branded' | 'filled'

export interface PreviewRequest {
  templateId: string
  variant?: PreviewVariant
  variables: Record<string, unknown>
}

export interface NumberingResponse {
  templateId: string
  prefix: string
  sequence: number
  number: string
}

export interface PreviewWarning {
  field: string
  message: string
  code?: string
}

export interface PreviewResponse {
  pdfBase64: string
  pageCount: number
  variant?: PreviewVariant
  warnings?: PreviewWarning[]
}

export interface CreateDocumentRequest {
  name: string
  template: string
  userId: string
  contactId: string
  organizationId?: string
  projectId?: string
  data: Record<string, unknown>
}

export interface CreateDocumentResponse {
  id: string
  templateId: string
  name: string
  sizeBytes: number
}

export type DocumentStatus =
  | 'Plan'
  | 'Draft'
  | 'Ready'
  | 'Delivered'
  | 'Sent'
  | 'Completed'
  | 'Voided'
  | (string & {})

export interface ProjectRef {
  id: string | null
  name: string
  slug: string
  status: string
}

export interface DocumentListItem {
  id: string
  templateId: string | null
  name: string
  mimeType: string
  sizeBytes: number | null
  status: DocumentStatus
  contact?: { index: number; name: string }
  project?: ProjectRef
  organizationId?: string | null
  previewUrl: string
  createdAt?: string
  updatedAt?: string
}

export interface Pagination {
  total: number
  limit: number
  offset: number
}

export interface DocumentList {
  results: DocumentListItem[]
  pagination: Pagination
}

export interface DocumentDetail {
  id: string
  templateId: string | null
  name: string
  mimeType: string
  sizeBytes: number | null
  status: DocumentStatus
  organizationId?: string | null
  project?: ProjectRef
  contact?: unknown[]
  user?: unknown
  routingType: string | null
  nextSigner: string | null
  routingQueue: unknown[] | null
  categories: unknown[]
  previewUrl: string
  createdAt?: string
  updatedAt?: string
  rawData: Record<string, unknown> | null
}

export interface UpdateDocumentRequest {
  name?: string
  status?: 'Plan' | 'Draft' | 'Ready' | 'Delivered'
}

export interface UpdateDocumentResponse {
  success: boolean
  message: string
  id?: string
}

export interface VoidDocumentResponse {
  documentStatus: 'Voided'
  fileName: string
}

export interface CreateSessionRequest {
  signerEmail: string
  expiresIn?: string
}

export interface CreateSessionResponse {
  signer: string
  expiresAt?: string | null
  sessionToken: string
}

export interface VerifySessionResponse {
  isValid: true
  signerEmail: string
  role: string
  order: number
  status: string
}

export interface PrepareSigningRequest {
  sessionToken: string
  fields?: Record<string, string>
  certificateDerHex?: string
  certificateChainDerHex?: string[]
  telemetry?: { ipAddress?: string; userAgent?: string }
}

export interface PrepareSigningResponse {
  sessionId: string
  digestHex?: string | null
  signerEmail: string
  documentStatus: string
}

export interface SignerState {
  order: number
  name: string
  email: string
  role: string
  status: string
  signedAt?: string
}

export interface SignResponse {
  id: string
  documentStatus: string
  currentSigner: SignerState
  nextSigner?: SignerState | null
}

export interface VerifySignatureResponse {
  isIntact?: boolean | Record<string, unknown>
  signer: string
  message: string
}

export interface DecorSummary {
  id: string
  label: string
  kind: 'illustration' | 'pattern' | 'frame'
  tintable: boolean
  slots: string[]
  thumbUrl: string
}

export interface DecorUpload {
  id: string
  url: string
}
export interface FontSummary {
  family: string
  name: string
}