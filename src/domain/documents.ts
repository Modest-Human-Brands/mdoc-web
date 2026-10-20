import type { DocumentDetail, DocumentListItem, SignerQueueEntry } from '@/api'

export const STATUS_FILTERS = ['All', 'Draft', 'Ready', 'Delivered', 'Voided'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export const EDITABLE_STATUSES = ['Plan', 'Draft', 'Ready', 'Delivered'] as const

export const PAGE_SIZE = 10

export function formatDay(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function pageRange(offset: number, shown: number, total: number): string {
  if (total === 0 || shown === 0) return '0 of 0'
  return `${offset + 1}–${offset + shown} of ${total}`
}

export function matchesSearch(item: DocumentListItem, query: string, label: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return `${item.name} ${label}`.toLowerCase().includes(needle)
}

export function isDraft(status: string): boolean {
  return status === 'Draft'
}

export function canSend(status: string): boolean {
  return status === 'Draft' || status === 'Ready'
}

export function signersOf(detail: Pick<DocumentDetail, 'routingQueue'>): SignerQueueEntry[] {
  const queue = Array.isArray(detail.routingQueue) ? detail.routingQueue : []
  return queue
    .filter((entry): entry is SignerQueueEntry => typeof entry === 'object' && entry !== null)
    .map((entry, index) => ({
      order: typeof entry.order === 'number' ? entry.order : index + 1,
      name: typeof entry.name === 'string' ? entry.name : '',
      email: typeof entry.email === 'string' ? entry.email : '',
      role: typeof entry.role === 'string' ? entry.role : 'Signer',
      status: typeof entry.status === 'string' ? entry.status : 'PENDING',
    }))
    .sort((a, b) => a.order - b.order)
}

export function signedCount(signers: SignerQueueEntry[]): number {
  return signers.filter((signer) => signer.status === 'SIGNED').length
}

export function signerCaption(
  signer: SignerQueueEntry,
  previous: SignerQueueEntry | undefined,
  next: boolean,
): string {
  if (signer.status === 'SIGNED') return signer.role
  if (signer.status === 'DECLINED') return 'Declined'
  if (signer.status === 'CANCELLED') return 'Cancelled'
  if (next) return 'Next'
  return previous ? `Waiting for ${previous.name || previous.email}` : 'Waiting'
}

export interface ActivityEntry {
  title: string
  detail: string
  at: string
}

export function activityOf(detail: DocumentDetail, signers: SignerQueueEntry[]): ActivityEntry[] {
  const entries: ActivityEntry[] = []
  if (detail.createdAt)
    entries.push({ title: 'Document created', detail: detail.name, at: detail.createdAt })
  if (detail.updatedAt && detail.updatedAt !== detail.createdAt) {
    entries.push({
      title: `Status: ${detail.status}`,
      detail: 'Last updated',
      at: detail.updatedAt,
    })
  }
  if (signers.length > 0) {
    const signed = signedCount(signers)
    const everyone = signed === signers.length
    const none = signed === 0
    entries.push({
      title: everyone ? 'Everyone signed' : none ? 'Not signed yet' : 'Signing in progress',
      detail: everyone
        ? `${signed} of ${signers.length} signed`
        : `${signers.length} ${signers.length === 1 ? 'signer' : 'signers'} queued`,
      at: detail.updatedAt ?? detail.createdAt ?? '',
    })
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at))
}