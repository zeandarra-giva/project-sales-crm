import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { STAGE_PROBABILITY } from '../../../lib/pipeline.js'

export const config = {
  name: 'ListPipelineStages',
  description: 'Returns all pipeline stages with duration thresholds and win probabilities',
  triggers: [{ type: 'http' as const, path: '/api/pipeline-stages', method: 'GET' as const }],
  enqueues: [],
  flows: ['deals'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const stages = await prisma.pipelineStage.findMany({
    orderBy: { name: 'asc' },
  })

  const withProbability = stages.map(s => ({
    ...s,
    probability: STAGE_PROBABILITY[s.name] ?? null,
  }))

  logger.info('Pipeline stages listed')
  return { status: 200, body: { stages: withProbability } }
}
