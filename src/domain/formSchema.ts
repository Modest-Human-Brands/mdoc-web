import { z } from 'zod'

import type { JsonSchema } from '@/api'

import {
  isBlankRow,
  isObjectSchema,
  labelFromPath,
  orderedProperties,
  singularLabel,
  stripExcluded,
  type Problem,
} from './schema'
import { checkLeaf } from './validate'

export type FormSchema = z.ZodObject<z.ZodRawShape>

type Kind = 'required' | 'invalid'

interface IssueParams {
  kind: Kind
  label: string
}

function report(ctx: z.RefinementCtx, kind: Kind, label: string, message: string): void {
  ctx.addIssue({ code: 'custom', message, params: { kind, label } satisfies IssueParams })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function leafSchema(node: JsonSchema, label: string, required: boolean) {
  return z.unknown().superRefine((value, ctx) => {
    if (node.type === 'boolean') return
    const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
    if (text.trim() === '') {
      if (required) report(ctx, 'required', label, `${label} is required`)
      return
    }
    const message = checkLeaf(node, text)
    if (message) report(ctx, 'invalid', label, message)
  })
}

function shapeOf(node: JsonSchema): z.ZodRawShape {
  const shape: Record<string, z.ZodType> = {}
  for (const [key, child] of orderedProperties(node)) {
    shape[key] = fieldSchema(
      child,
      node.required?.includes(key) ?? false,
      child.title ?? labelFromPath(key),
    )
  }
  return shape
}

function nestedObject(node: JsonSchema) {
  return z.preprocess((value) => (isRecord(value) ? value : {}), z.object(shapeOf(node)))
}

function arraySchema(node: JsonSchema, required: boolean, label: string) {
  const items = node.items
  const rowSchema = items
    ? isObjectSchema(items)
      ? nestedObject(items)
      : leafSchema(items, singularLabel(label), false)
    : z.unknown()

  return z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(z.unknown()).superRefine((rows, ctx) => {
      if (!items) return
      let filled = 0
      rows.forEach((row, index) => {
        if (isBlankRow(items, row)) return
        filled += 1
        const result = rowSchema.safeParse(row)
        if (result.success) return
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: 'custom',
            message: issue.message,
            path: [index, ...issue.path],
            params: (issue as { params?: IssueParams }).params,
          })
        }
      })
      if (required && filled === 0) report(ctx, 'required', label, `${label} is required`)
    }),
  )
}

function fieldSchema(node: JsonSchema, required: boolean, label: string): z.ZodType {
  if (isObjectSchema(node)) return nestedObject(node)
  if (node.type === 'array') return arraySchema(node, required, label)
  return leafSchema(node, label, required)
}

export function buildFormSchema(schema: JsonSchema): FormSchema {
  return z.object(shapeOf(stripExcluded(schema)))
}

export const emptyFormSchema: FormSchema = z.object({})

export function problemsFromIssues(issues: readonly z.core.$ZodIssue[]): Problem[] {
  return issues.map((issue) => {
    const params = (issue as { params?: Partial<IssueParams> }).params
    const kind: Kind = params?.kind ?? 'invalid'
    const path = issue.path.map(String).join('.')
    return kind === 'invalid' && params?.label
      ? { path, kind, message: `${params.label}: ${issue.message}`, hint: issue.message }
      : { path, kind, message: issue.message }
  })
}

export function validateForm(schema: FormSchema, values: unknown): Problem[] {
  const result = schema.safeParse(values)
  return result.success ? [] : problemsFromIssues(result.error.issues)
}