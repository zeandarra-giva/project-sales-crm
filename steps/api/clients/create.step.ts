import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  brand: z.string().max(100).optional(),
  accountType: z.enum(['ENTERPRISE', 'CORPORATE', 'SMB', 'GOVERNMENT']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']).default('PROSPECT'),
  industryId: z.string().uuid().optional(),
})

export const config = {
  name: 'CreateClient',
  description: 'Create a new client account',
  triggers: [{ type: 'http' as const, path: '/api/clients', method: 'POST' as const, bodySchema }],
  enqueues: [],
  flows: ['clients'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { industryId, ...rest } = req.body
  const client = await prisma.client.create({
    data: {
      ...rest,
      ...(industryId ? { industry: { connect: { id: industryId } } } : {}),
    },
    include: { industry: true },
  })
  logger.info('Client created', { clientId: client.id })
  return { status: 201, body: { client } }
}