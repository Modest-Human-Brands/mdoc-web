import type { DocumentDetail, DocumentListItem, SignerQueueEntry } from '@/api'

import { formatBytes } from './format'

export const STATUS_FILTERS = ['All', 'Draft', 'Ready', 'Delivered', 'Void'] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export const EDITABLE_STATUSES = ['Plan', 'Draft', 'Ready', 'Delivered'] as const

export const PAGE_SIZE = 24

export function formatDay(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "PDF · 7 Oct 2026 · 1 page · 25.8 KB"; the page count is left out until the PDF is read. */
export function documentMeta(
  detail: Pick<DocumentDetail, 'createdAt' | 'sizeBytes'>,
  pages: number,
): string {
  const count = pages > 0 ? `${pages} ${pages === 1 ? 'page' : 'pages'}` : ''
  return ['PDF', formatDay(detail.createdAt), count, formatBytes(detail.sizeBytes ?? -1)]
    .filter(Boolean)
    .join(' · ')
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

const STATUS_CHANGEABLE = ['Plan', 'Draft', 'Ready']
const NOT_VOIDABLE = ['Completed', 'Void']

export function isDraft(status: string): boolean {
  return status === 'Draft'
}

export function canChangeStatus(status: string): boolean {
  return STATUS_CHANGEABLE.includes(status)
}

export function isVoid(status: string): boolean {
  return status === 'Void'
}

export function canVoid(status: string): boolean {
  return !NOT_VOIDABLE.includes(status)
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
      ...(typeof entry.signedAt === 'string' ? { signedAt: entry.signedAt } : {}),
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
  if (next) return 'Next to sign'
  return previous ? `Waiting for ${previous.name || previous.email}` : 'Waiting'
}

export function signerTag(signer: Pick<SignerQueueEntry, 'status'>, next: boolean): string {
  if (signer.status === 'SIGNED') return 'Signed'
  if (signer.status === 'DECLINED') return 'Declined'
  if (signer.status === 'CANCELLED') return 'Cancelled'
  return next ? 'Next' : 'Waiting'
}

/** The backend calls it "Void"; screens say what happened to the document. */
export function statusLabel(status: string): string {
  return status === 'Void' ? 'Voided' : status
}

export function userNameOf(user: unknown): string {
  if (typeof user !== 'object' || user === null || !('name' in user)) return ''
  return typeof user.name === 'string' ? user.name.trim() : ''
}

const NOT_SENT = ['Plan', 'Draft', 'Ready']

export interface ActivityEntry {
  title: string
  detail: string
  at: string
}

/** Oldest first. An entry without a date has not happened yet, so it goes last. */
export function activityOf(detail: DocumentDetail, signers: SignerQueueEntry[]): ActivityEntry[] {
  const entries: ActivityEntry[] = []
  if (detail.createdAt) {
    const author = userNameOf(detail.user)
    entries.push({
      title: 'Document created',
      detail: author ? `Created by ${author}` : detail.name,
      at: detail.createdAt,
    })
  }
  if (isVoid(detail.status)) {
    entries.push({ title: 'Document voided', detail: '', at: detail.updatedAt ?? '' })
  } else if (detail.updatedAt && detail.updatedAt !== detail.createdAt) {
    entries.push({
      title: `Status: ${detail.status}`,
      detail: 'Last updated',
      at: detail.updatedAt,
    })
  }
  if (signers.length > 0 && !isVoid(detail.status)) {
    const signed = signedCount(signers)
    const everyone = signed === signers.length
    const unsent = signed === 0 && NOT_SENT.includes(detail.status)
    const queued = `${signers.length} ${signers.length === 1 ? 'signer' : 'signers'} queued`
    entries.push({
      title: everyone
        ? 'Everyone signed'
        : unsent
          ? 'Not sent yet'
          : signed === 0
            ? 'Not signed yet'
            : 'Signing in progress',
      detail: everyone ? `${signed} of ${signers.length} signed` : queued,
      at: unsent ? '' : (detail.updatedAt ?? detail.createdAt ?? ''),
    })
  }
  return entries.sort((a, b) => (a.at || '\uffff').localeCompare(b.at || '\uffff'))
}
export const BOARD_COLUMNS = ['Draft', 'Ready', 'Sent', 'Partially Signed', 'Signed'] as const
export type BoardColumn = (typeof BOARD_COLUMNS)[number] | 'Void'

/** Backend statuses without a column of their own fall into the nearest stage. */
export function boardColumn(status: string): BoardColumn {
  switch (status) {
    case 'Ready':
      return 'Ready'
    case 'Sent':
    case 'Delivered':
      return 'Sent'
    case 'Partially Signed':
      return 'Partially Signed'
    case 'Completed':
    case 'Signed':
      return 'Signed'
    case 'Void':
      return 'Void'
    default:
      return 'Draft'
  }
}

export function groupByColumn<T extends { status: string }>(
  items: readonly T[],
): { column: BoardColumn; items: T[] }[] {
  const groups = new Map<BoardColumn, T[]>(BOARD_COLUMNS.map((column) => [column, []]))
  for (const item of items) {
    const column = boardColumn(item.status)
    groups.set(column, [...(groups.get(column) ?? []), item])
  }
  return [...groups]
    .filter(([column, list]) => column !== 'Void' || list.length > 0)
    .map(([column, list]) => ({ column, items: list }))
}

const UNITS: readonly (readonly [string, number])[] = [
  ['w', 604_800_000],
  ['d', 86_400_000],
  ['h', 3_600_000],
  ['m', 60_000],
]

/** "2h ago", "1d ago"; empty when the date is missing or unreadable. */
export function formatAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return ''
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const diff = Math.max(0, now - time)
  for (const [unit, size] of UNITS) if (diff >= size) return `${Math.floor(diff / size)}${unit} ago`
  return 'just now'
}

export function initialOf(name: string | undefined): string {
  return name?.trim().charAt(0).toUpperCase() ?? ''
}