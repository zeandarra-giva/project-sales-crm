import { type Handlers, type StepConfig } from 'motia'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'

export const config = {
    name: 'ListDeals',
    description: 'Get list of deals for the current user (or all if manager)',
    triggers: [
        {
            type: 'http' as const,
            method: 'GET' as const,
            path: '/api/deals',
        },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
    try {
        const user = await authenticate(req)

        // If Manager, they can see all deals.
        // If BD Rep, they can only see their own deals.
        const whereClause = user.role === 'SALES_MANAGER' ? {} : { bdId: user.id }

        const deals = await prisma.deal.findMany({
            where: whereClause,
            include: {
                client: true,
                stage: true,
                bd: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    }
                },
                service: true,
                bundle: true,
            },
            orderBy: {
                startDate: 'desc'
            }
        })

        // Map the result to match the frontend expectations slightly, 
        // especially computing `days_in_stage` which usually lives on the Deal Audit Log, 
        // but we'll mock it for now with difference between `now` and `lastStageUpdateAt`.
        const formattedDeals = deals.map(deal => {
            const today = new Date()
            const lastUpdate = deal.lastStageUpdateAt || deal.startDate || today
            const daysInStage = Math.floor((today.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24))

            return {
                ...deal,
                stage_name: deal.stage.name,
                days_in_stage: daysInStage,
            }
        })

        return {
            status: 200,
            body: formattedDeals,
        }
    } catch (error: any) {
        logger.warn('Failed to list deals', { error: error.message })
        return {
            status: error.message === 'Not authenticated' ? 401 : 500,
            body: { error: error.message },
        }
    }
}
