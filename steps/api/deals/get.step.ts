import { type Handlers, type StepConfig, logger } from 'motia'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'

const currentAuditLogSelect = Prisma.validator<Prisma.DealAuditLogSelect>()({
    id: true,
    enteredAt: true,
    remarks: true,
    actionPlan: true,
    actionPlanDueDate: true,
    notes: true,
    changedBy: {
        select: { id: true, firstName: true, lastName: true },
    },
})

export const config = {
    name: 'GetDeal',
    description: 'Get a single deal by ID with full details (supports DealDetail page)',
    triggers: [
        { type: 'http' as const, method: 'GET' as const, path: '/api/deals/:id' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams

        const deal = await prisma.deal.findUnique({
            where: { id },
            include: {
                stage: true,
                bd: { select: { id: true, firstName: true, lastName: true } },
                client: {
                    select: {
                        id: true,
                        name: true,
                        brand: true,
                        accountType: true,
                        status: true,
                        industryId: true,
                        contactId: true,
                        contact: {
                            select: { id: true, firstName: true, lastName: true },
                        },
                        contacts: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                number: true,
                                designation: true,
                                decisionRank: true,
                                isPrimary: true,
                                clientId: true,
                            },
                            orderBy: [
                                { isPrimary: 'desc' },
                                { lastName: 'asc' },
                                { firstName: 'asc' },
                            ],
                        },
                    },
                },
                service: true,
                bundle: true,
                projection: true,
                dealContacts: {
                    include: {
                        contact: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                number: true,
                                designation: true,
                            },
                        },
                    },
                    orderBy: { isPrimary: 'desc' },
                },
                // Current stage audit log — provides remarks/actionPlan (Rev 1–3)
                auditLogs: {
                    where: { exitedAt: null },
                    take: 1,
                    orderBy: { enteredAt: 'desc' },
                    select: currentAuditLogSelect,
                },
                _count: {
                    select: { auditLogs: true, dealContacts: true },
                },
            },
        })

        if (!deal) {
            return { status: 404, body: { error: 'Deal not found' } }
        }

        // BD Reps can only view their own deals (FR-PRE-002)
        if (user.role !== 'SALES_MANAGER' && deal.bdId !== user.id) {
            return { status: 403, body: { error: 'You can only view your own deals' } }
        }

        return { status: 200, body: deal }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to get deal', { error: error.message, dealId: req.request.pathParams.id })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
