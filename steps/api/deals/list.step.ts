import type { StepConfig, Handlers } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'ListDeals',
    description: 'Get list of all deals',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/deals' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
    try {
        const user = await authenticate(req)
        logger.info('Listing deals', { userId: user.id })

        const deals = await prisma.deal.findMany({
            include: {
                stage: true,                              // pipeline stage info
                bd: { select: { id: true, firstName: true, lastName: true } },
                client: {
                    select: {
                        id: true,
                        name: true,
                        accountType: true,
                        contact: { // This is how you get the Client's Primary Contact
                            select: { id: true, firstName: true, lastName: true }
                        }
                    }
                },
                service: true,
                bundle: true,
                _count: {
                    select: {
                        auditLogs: true,
                        dealContacts: true
                    }
                },
            },
            orderBy: { startDate: 'desc' },
        })

        return { status: 200, body: deals }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to list deals', { error })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}