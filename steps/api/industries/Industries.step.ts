import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'IndustriesList',
  description: 'List all industries',
  triggers: [{ type: 'http' as const, path: '/api/industries', method: 'GET' as const }],
  enqueues: [],
  flows: ['services'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const industries = await prisma.industry.findMany({ orderBy: { name: 'asc' } })
  return { status: 200, body: { industries } }
}