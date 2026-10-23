import { describe, expect, it } from 'vite-plus/test'

import { emptyOrganization } from '../organization'
import { organizationFormSchema } from '../organizationForm'

const required = { name: 'Acme', contactEmail: 'hi@acme.co' }

function issues(changes: Record<string, unknown>, base: Record<string, unknown> = required) {
  const result = organizationFormSchema.safeParse({
    ...emptyOrganization(),
    ...base,
    ...changes,
  })
  return result.success ? [] : result.error.issues.map((i) => [i.path.join('.'), i.message])
}

describe('organizationFormSchema', () => {
  it('accepts a profile with a name and contact email, and requires both', () => {
    expect(issues({})).toEqual([])
    expect(issues({}, {}).map(([path]) => path)).toEqual(['name', 'contactEmail'])
  })

  it('requires https links for the website and every social', () => {
    const base = emptyOrganization()
    expect(issues({ website: 'http://zzz.example' })).toEqual([['website', 'Use an https:// link']])
    expect(issues({ socials: { ...base.socials, youtube: 'youtube.com/x' } })).toEqual([
      ['socials.youtube', 'Use an https:// link'],
    ])
  })

  it('checks the founding year range', () => {
    expect(issues({ foundedYear: '2019' })).toEqual([])
    expect(issues({ foundedYear: '1800' })).toHaveLength(1)
    expect(issues({ foundedYear: '20x9' })).toHaveLength(1)
    expect(issues({ foundedYear: String(new Date().getFullYear() + 1) })).toHaveLength(1)
  })

  it('keeps the existing colour and email rules', () => {
    expect(issues({ primary: 'red', contactEmail: 'nope' }).map(([path]) => path)).toEqual([
      'primary',
      'contactEmail',
    ])
  })
})