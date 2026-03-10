import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'BundlesList',
  description: 'List all bundles with their services',
  triggers: [{ type: 'http' as const, path: '/api/bundles', method: 'GET' as const }],
  enqueues: [],
  flows: ['services'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const bundles = await prisma.bundle.findMany({
    include: { bundleServices: { include: { service: true } } },
    orderBy: { name: 'asc' },
  })
  logger.info('Bundles listed', { count: bundles.length })
  return { status: 200, body: { bundles } }
}