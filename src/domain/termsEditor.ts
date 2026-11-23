/** The terms editor offers only what the PDF renders. */
export const ALLOWED_NODES = [
  'doc',
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'hardBreak',
  'text',
] as const

export const ALLOWED_MARKS = ['bold', 'italic'] as const

export const MAX_HEADING = 3

export interface SlashItem {
  id: 'paragraph' | 'heading-1' | 'heading-2' | 'heading-3' | 'bullet-list' | 'ordered-list'
  label: string
  hint: string
  keywords: string
}

export const SLASH_ITEMS: readonly SlashItem[] = [
  { id: 'paragraph', label: 'Text', hint: 'Plain paragraph', keywords: 'text paragraph body' },
  { id: 'heading-1', label: 'Heading 1', hint: 'Large heading', keywords: 'heading title h1' },
  { id: 'heading-2', label: 'Heading 2', hint: 'Medium heading', keywords: 'heading h2' },
  { id: 'heading-3', label: 'Heading 3', hint: 'Small heading', keywords: 'heading h3' },
  { id: 'bullet-list', label: 'Bullet list', hint: 'Unordered list', keywords: 'bullet list ul' },
  { id: 'ordered-list', label: 'Numbered list', hint: 'Ordered list', keywords: 'number list ol' },
]

export function filterSlash(query: string): SlashItem[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...SLASH_ITEMS]
  return SLASH_ITEMS.filter((item) =>
    `${item.label} ${item.keywords}`.toLowerCase().includes(needle),
  )
}

export const VARIABLE_SUGGESTIONS = [
  'recipient.name',
  'recipient.email',
  'project.title',
  'organization.name',
] as const

export function isValidVariable(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(name.trim())
}

export function variableToken(name: string): string {
  return `{{${name.trim()}}}`
}

interface DocNode {
  type?: string
  attrs?: Record<string, unknown>
  marks?: { type?: string }[]
  content?: DocNode[]
  text?: string
}

function isNode(value: unknown): value is DocNode {
  return value !== null && typeof value === 'object'
}

function clean(node: DocNode): DocNode[] {
  const children = (node.content ?? []).flatMap(clean)
  const type = node.type ?? ''
  if (!(ALLOWED_NODES as readonly string[]).includes(type)) {
    // Tables, callouts, task lists and code are not rendered: keep their text as blocks.
    const inline = children.some((child) => child.type === 'text' || child.type === 'hardBreak')
    return inline ? [{ type: 'paragraph', content: children }] : children
  }
  if (type === 'text') {
    const marks = (node.marks ?? []).filter((mark) =>
      (ALLOWED_MARKS as readonly string[]).includes(mark.type ?? ''),
    )
    return node.text ? [{ type, text: node.text, ...(marks.length > 0 ? { marks } : {}) }] : []
  }
  if (type === 'heading') {
    const level = Number(node.attrs?.level)
    const safe = Number.isInteger(level) ? Math.min(Math.max(level, 1), MAX_HEADING) : MAX_HEADING
    return [{ type, attrs: { level: safe }, content: children }]
  }
  return [{ type, ...(children.length > 0 ? { content: children } : {}) }]
}

/** Strips anything the terms editor does not support from a saved Tiptap document. */
export function sanitizeTermDoc(doc: unknown): { type: 'doc'; content: DocNode[] } {
  const root = isNode(doc) ? doc : {}
  const content = (root.content ?? []).flatMap(clean)
  return { type: 'doc', content }
}