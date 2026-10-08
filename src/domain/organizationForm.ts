import { z } from 'zod'

import { ENTITY_TYPES, isEmail, normalizeHex } from './organization'

const hexColour = z
  .string()
  .refine((value) => normalizeHex(value) !== null, 'Enter a hex colour like #5945EA')

const optionalEmail = z
  .string()
  .refine((value) => value.trim() === '' || isEmail(value), 'Enter a valid email address')

export const organizationFormSchema = z.object({
  id: z.string().refine((value) => value.trim() !== '', 'Organisation is required'),
  name: z.string(),
  legalName: z.string(),
  entityType: z.enum(ENTITY_TYPES),
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
})