import { describe, expect, it } from 'vite-plus/test'

import type { JsonSchema, TemplateDetail } from '@/api'
import internshipFixture from '@/test/fixtures/internship-completion-certificate.json'
import invoiceFixture from '@/test/fixtures/invoice.json'

import { buildFormSchema, validateForm } from '../formSchema'
import { emptyValue, setPath, stripExcluded } from '../schema'

const invoice = (invoiceFixture as unknown as TemplateDetail).schema
const internship = (internshipFixture as unknown as TemplateDetail).schema

function problemsFor(schema: JsonSchema, values: unknown) {
  return validateForm(buildFormSchema(schema), values)
}

describe('validateForm with the real server schemas', () => {
  const blank = emptyValue(stripExcluded(internship))

  it('lists blank required fields by path with a readable message', () => {
    const problems = problemsFor(internship, setPath(blank, ['recipient', 'name'], 'A'))

    expect(problems.map((p) => p.path)).toContain('recipient.email')
    expect(problems.map((p) => p.path)).not.toContain('recipient.name')
    expect(problems.find((p) => p.path === 'recipient.email')).toMatchObject({
      kind: 'required',
      message: 'Email is required',
    })
  })

  it('reports an entered-but-invalid value as "invalid" with a bare hint', () => {
    const form = setPath(setPath(blank, ['recipient', 'email'], 'acc'), ['recipient', 'name'], 'A')

    const email = problemsFor(internship, form).find((p) => p.path === 'recipient.email')

    expect(email).toMatchObject({
      kind: 'invalid',
      message: 'Email: Enter a valid email address',
      hint: 'Enter a valid email address',
    })
  })

  it('has no problems for a complete, valid form', () => {
    const form = {
      recipient: {
        name: 'Alex',
        role: 'Intern',
        address: 'Mumbai',
        email: 'a@b.in',
        phone: '1',
      },
      scopeOfWork: 'Brand design',
      startDate: '2026-01-01',
      endDate: '2026-06-01',
    }

    expect(problemsFor(internship, form)).toEqual([])
  })

  it('tolerates a form with missing sections instead of throwing', () => {
    const problems = problemsFor(internship, {})

    expect(problems.map((p) => p.path)).toContain('recipient.name')
    expect(problemsFor(internship, undefined).length).toBeGreaterThan(0)
  })

  it('validates real calendar dates and number minimums', () => {
    const form = setPath(blank, ['startDate'], '2026-02-30')

    expect(problemsFor(internship, form).find((p) => p.path === 'startDate')?.hint).toBe(
      'Use a real date as YYYY-MM-DD',
    )
  })
})

describe('arrays', () => {
  it('requires a non-blank row for a required array (the server declares no row-level required)', () => {
    const blank = emptyValue(stripExcluded(invoice))
    expect(problemsFor(invoice, blank).map((p) => p.path)).toContain('project.deliverables')

    const half = setPath(blank, ['project', 'deliverables', 0, 'title'], 'Ad film')
    expect(problemsFor(invoice, half).map((p) => p.path)).not.toContain('project.deliverables')
  })

  it('does not count a row holding only the default quantity as filled', () => {
    const form = setPath(
      emptyValue(stripExcluded(invoice)),
      ['project', 'deliverables', 0, 'quantity'],
      '1',
    )

    expect(problemsFor(invoice, form).map((p) => p.path)).toContain('project.deliverables')
  })

  it('validates required fields inside filled rows, with indexed paths', () => {
    const rows: JsonSchema = {
      type: 'object',
      required: ['lines'],
      properties: {
        lines: {
          type: 'array',
          title: 'Lines',
          items: {
            type: 'object',
            required: ['title', 'rate'],
            properties: {
              title: { type: 'string', title: 'Title' },
              rate: { type: 'number', title: 'Rate', minimum: 0 },
            },
          },
        },
      },
    }
    const partial = {
      lines: [
        { title: 'Ad film', rate: '' },
        { title: '', rate: '' },
        { title: 'X', rate: '-5' },
      ],
    }

    const problems = problemsFor(rows, partial)

    expect(problems.map((p) => `${p.path}:${p.kind}`)).toEqual([
      'lines.0.rate:required',
      'lines.2.rate:invalid',
    ])
    expect(problems[1]?.message).toBe('Rate: Must be at least 0')
  })
})

describe('optional fields', () => {
  it('stay quiet when blank but are still validated when filled', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', title: 'Name' },
        email: { type: 'string', format: 'email', title: 'Email' },
      },
    }

    expect(problemsFor(schema, { name: 'A', email: '' })).toEqual([])
    expect(problemsFor(schema, { name: 'A', email: 'bad' })[0]).toMatchObject({
      path: 'email',
      kind: 'invalid',
    })
  })
})