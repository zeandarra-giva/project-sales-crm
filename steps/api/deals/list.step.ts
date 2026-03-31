import { type StepConfig, type Handlers, logger } from 'motia'
import { Prisma } from '@prisma/client'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

const currentAuditLogSelect = Prisma.validator<Prisma.DealAuditLogSelect>()({
    id: true,
    enteredAt: true,
    remarks: true,
    actionPlan: true,
    actionPlanDueDate: true,
})

export const config = {
    name: 'ListDeals',
    description: 'Get list of all deals',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/deals' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        logger.info('Listing deals', { userId: user.id })

        // If Manager, they can see all deals.
        // If BD Rep, they can only see their own deals.
        const whereClause = user.role === 'SALES_MANAGER' ? {} : { bdId: user.id }

        const deals = await prisma.deal.findMany({
            where: whereClause,
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
                // Current stage audit log for remarks/actionPlanDueDate (Rev 1–3)
                auditLogs: {
                    where: { exitedAt: null },
                    take: 1,
                    orderBy: { enteredAt: 'desc' },
                    select: currentAuditLogSelect,
                },
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
