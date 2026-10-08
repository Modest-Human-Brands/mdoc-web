import { z } from 'zod'

import {
  ENTITY_TYPES,
  foundedYearError,
  isEmail,
  normalizeHex,
  TRADE_RELATIONSHIPS,
} from './organization'
import { isHttpsUrl } from './url'

const hexColour = z
  .string()
  .refine((value) => normalizeHex(value) !== null, 'Enter a hex colour like #5945EA')

const optionalEmail = z
  .string()
  .refine((value) => value.trim() === '' || isEmail(value), 'Enter a valid email address')

const optionalUrl = z
  .string()
  .refine((value) => value.trim() === '' || isHttpsUrl(value), 'Use an https:// link')

const optionalYear = z.string().superRefine((value, ctx) => {
  const message = foundedYearError(value)
  if (message) ctx.addIssue({ code: 'custom', message })
})

export const organizationFormSchema = z.object({
  id: z.string().refine((value) => value.trim() !== '', 'Organisation is required'),
  name: z.string(),
  legalName: z.string(),
  entityType: z.enum(ENTITY_TYPES),
  tradeRelationship: z.enum(TRADE_RELATIONSHIPS),
  address: z.string(),
  foundedYear: optionalYear,
  pan: z.string(),
  gstin: z.string(),
  logo: z.object({ name: z.string(), dataUrl: z.string() }).nullable(),
  primary: hexColour,
  accent: hexColour,
  font: z.string(),
  bank: z.object({
    accountName: z.string(),
    accountNumber: z.string(),
    bankName: z.string(),
    ifscCode: z.string(),
  }),
  contactEmail: optionalEmail,
  billingEmail: optionalEmail,
  phone: z.string(),
  whatsapp: z.string(),
  website: optionalUrl,
  socials: z.object({
    instagram: optionalUrl,
    facebook: optionalUrl,
    linkedin: optionalUrl,
    youtube: optionalUrl,
  }),
})