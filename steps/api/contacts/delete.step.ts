import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

const bodySchema = z.object({
  firstName: z.string().min(1).max(30).optional(),
  lastName: z.string().min(1).max(30).optional(),
  email: z.string().email().max(100).optional(),
  number: z.string().max(15).optional(),
  designation: z.string().max(100).optional(),
  decisionRank: z.enum(['TIER_1_ECONOMIC_BUYER', 'TIER_2_DECISION_MAKER', 'TIER_3_INFLUENCER', 'TIER_4_END_USER', 'TIER_5_GATEKEEPER']).optional(),
  isPrimary: z.boolean().optional(),
})

export const config = {
  name: 'UpdateContact',
  description: 'Update an existing contact',
  triggers: [{ type: 'http' as const, path: '/api/contacts/:id', method: 'PATCH' as const, bodySchema }],
  enqueues: [],
  flows: ['contacts'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams as { id: string }
  const contact = await prisma.contact.update({ where: { id }, data: req.body })
  logger.info('Contact updated', { contactId: id })
  return { status: 200, body: { contact } }
}