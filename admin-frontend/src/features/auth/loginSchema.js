import { z } from 'zod'

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'L’identifiant est requis.'),
  password: z.string().min(1, 'Le mot de passe est requis.'),
})
