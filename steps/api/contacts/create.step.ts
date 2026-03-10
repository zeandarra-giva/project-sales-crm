import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

const bodySchema = z.object({
  firstName: z.string().min(1).max(30),
  lastName: z.string().min(1).max(30),
  email: z.string().email().max(100),
  number: z.string().max(15).optional(),
  designation: z.string().max(100).optional(),
  decisionRank: z.enum([
    'TIER_1_ECONOMIC_BUYER', 'TIER_2_DECISION_MAKER', 'TIER_3_INFLUENCER',
    'TIER_4_END_USER', 'TIER_5_GATEKEEPER',
  ]),
  isPrimary: z.boolean().default(false),
  clientId: z.uuid(),
})

export const config = {
  name: 'CreateContact',
  description: 'Create a new contact linked to a client',
  triggers: [{ type: 'http' as const, path: '/api/contacts', method: 'POST' as const, bodySchema }],
  enqueues: [],
  flows: ['contacts'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const contact = await prisma.contact.create({ data: req.body })
  logger.info('Contact created', { contactId: contact.id })
  return { status: 201, body: { contact } }
}
