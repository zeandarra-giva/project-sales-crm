import { type Handlers, type StepConfig, logger } from 'motia'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'

export const config = {
    name: 'ListPipelineStages',
    description: 'Return all pipeline stages ordered by probability (used for stage picker in DealDetail)',
    triggers: [
        {
            type: 'http' as const,
            method: 'GET' as const,
            path: '/api/pipeline-stages',
        },
    ],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req) => {
    try {
        await authenticate(req.request)

        const stages = await prisma.pipelineStage.findMany({
            orderBy: { name: 'asc' }, // will be sorted by a fixed order on frontend
        })

        logger.info('Pipeline stages fetched', { count: stages.length })
        return { status: 200, body: stages }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to fetch pipeline stages', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
