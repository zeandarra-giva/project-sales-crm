import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'ServicesList',
  description: 'List all active services',
  triggers: [{ type: 'http' as const, path: '/api/services', method: 'GET' as const }],
  enqueues: [],
  flows: ['services'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  logger.info('Services listed', { count: services.length })
  return { status: 200, body: { services } }
}