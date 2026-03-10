import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  brand: z.string().max(100).optional(),
  accountType: z.enum(['ENTERPRISE', 'CORPORATE', 'SMB', 'GOVERNMENT']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT']).optional(),
  industryId: z.string().uuid().optional(),
})

export const config = {
  name: 'UpdateClient',
  description: 'Update an existing client',
  triggers: [{ type: 'http' as const, path: '/api/clients/:id', method: 'PATCH' as const, bodySchema }],
  enqueues: [],
  flows: ['clients'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams as { id: string }
  const { industryId, ...rest } = req.body
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...rest,
      ...(industryId ? { industry: { connect: { id: industryId } } } : {}),
    },
    include: { industry: true },
  })
  logger.info('Client updated', { clientId: id })
  return { status: 200, body: { client } }
}