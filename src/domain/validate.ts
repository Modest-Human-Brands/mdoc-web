import type { JsonSchema } from '@/api'

const EMAIL_FALLBACK = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

export function isRealDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return false
  const [, year, month, day] = match.map(Number) as [number, number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

function compile(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

export function checkLeaf(schema: JsonSchema, value: unknown): string | null {
  if (isBlank(value) || schema.type === 'boolean') return null
  const text = typeof value === 'string' ? value.trim() : String(value)

  if (schema.enum && !schema.enum.map(String).includes(text)) {
    return `Choose one of: ${schema.enum.join(', ')}`
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    const parsed = Number.parseFloat(text.replace(/,/g, ''))
    if (!/^-?[\d,]*\.?\d+$/.test(text) || !Number.isFinite(parsed)) return 'Enter a number'
    if (schema.type === 'integer' && !Number.isInteger(parsed)) return 'Enter a whole number'
    if (schema.minimum !== undefined && parsed < schema.minimum) {
      return `Must be at least ${schema.minimum}`
    }
    if (schema.maximum !== undefined && parsed > schema.maximum) {
      return `Must be at most ${schema.maximum}`
    }
    return null
  }

  if (schema.format === 'date' && !isRealDate(text)) return 'Use a real date as YYYY-MM-DD'

  if (schema.format === 'email') {
    const pattern = schema.pattern ? compile(schema.pattern) : null
    return (pattern ?? EMAIL_FALLBACK).test(text) ? null : 'Enter a valid email address'
  }

  if (schema.pattern) {
    const pattern = compile(schema.pattern)
    if (pattern && !pattern.test(text)) return 'Not in the expected format'
  }
  if (schema.minLength !== undefined && text.length < schema.minLength) {
    return `Use at least ${schema.minLength} characters`
  }
  if (schema.maxLength !== undefined && text.length > schema.maxLength) {
    return `Use at most ${schema.maxLength} characters`
  }
  return null
}