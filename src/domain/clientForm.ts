import { z } from 'zod'

import { isEmail } from './organization'

export const clientFormSchema = z.object({
  name: z.string().refine((value) => value.trim() !== '', 'Name is required'),
  email: z
    .string()
    .refine((value) => value.trim() === '' || isEmail(value), 'Enter a valid email address'),
  phone: z.string(),
  address: z.string(),
})