import { describe, expect, it } from 'vite-plus/test'

import {
  filterSlash,
  isValidVariable,
  sanitizeTermDoc,
  SLASH_ITEMS,
  variableToken,
} from '../termsEditor'

describe('slash menu', () => {
  it('offers only headings, text and lists', () => {
    expect(SLASH_ITEMS.map((item) => item.id)).toEqual([
      'paragraph',
      'heading-1',
      'heading-2',
      'heading-3',
      'bullet-list',
      'ordered-list',
    ])
  })

  it('filters by label and keyword', () => {
    expect(filterSlash('')).toHaveLength(6)
    expect(filterSlash('num').map((i) => i.id)).toEqual(['ordered-list'])
    expect(filterSlash('h2').map((i) => i.id)).toEqual(['heading-2'])
    expect(filterSlash('table')).toEqual([])
  })
})

describe('variables', () => {
  it('accepts dotted names and wraps them in braces', () => {
    expect(isValidVariable('recipient.name')).toBe(true)
    expect(isValidVariable('1bad')).toBe(false)
    expect(isValidVariable('a b')).toBe(false)
    expect(variableToken(' project.title ')).toBe('{{project.title}}')
  })
})

describe('sanitizeTermDoc', () => {
  const text = (value: string, marks: string[] = []) => ({
    type: 'text',
    text: value,
    ...(marks.length > 0 ? { marks: marks.map((type) => ({ type })) } : {}),
  })

  it('keeps supported nodes and marks, drops the rest', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 5 }, content: [text('Title')] },
        { type: 'paragraph', content: [text('Hi', ['bold', 'underline', 'italic'])] },
        { type: 'codeBlock', content: [text('x = 1')] },
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', content: [{ type: 'paragraph', content: [text('todo')] }] },
          ],
        },
        { type: 'horizontalRule' },
      ],
    }

    expect(sanitizeTermDoc(doc)).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [text('Title')] },
        { type: 'paragraph', content: [text('Hi', ['bold', 'italic'])] },
        { type: 'paragraph', content: [text('x = 1')] },
        { type: 'paragraph', content: [text('todo')] },
      ],
    })
  })

  it('returns an empty document for nothing', () => {
    expect(sanitizeTermDoc(null)).toEqual({ type: 'doc', content: [] })
  })
})