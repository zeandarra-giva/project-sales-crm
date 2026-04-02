import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { buildCollectionsOverview } from '../../../lib/paymentsCollections'

export const config = {
    name: 'PaymentsOverview',
    description: 'Collections overview for the Payments page',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/payments/overview' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)

        const requestedBdId = req.request.queryParams?.bdId as string | undefined
        const year = req.request.queryParams?.year ? Number(req.request.queryParams.year) : undefined
        const quarter = req.request.queryParams?.quarter ? Number(req.request.queryParams.quarter) : undefined

        if (requestedBdId && user.role !== 'SALES_MANAGER' && requestedBdId !== user.id) {
            return { status: 403, body: { error: 'You can only view your own collections overview' } }
        }

        const scopedBdId = user.role === 'SALES_MANAGER' ? requestedBdId : user.id

        const deals = await prisma.deal.findMany({
            where: {
                OR: [
                    { stage: { name: 'Closed Won' } },
                    { isClosed: true },
                ],
                ...(scopedBdId ? { bdId: scopedBdId } : {}),
            },
            include: {
                bd: { select: { id: true, firstName: true, lastName: true } },
                client: { select: { id: true, name: true, accountType: true } },
                payments: {
                    include: {
                        date: { select: { year: true, month: true, quarter: true } },
                    },
                },
            },
            orderBy: [{ closedDate: 'desc' }, { dealName: 'asc' }],
        })

        const overview = buildCollectionsOverview(
            deals.map((deal) => ({
                id: deal.id,
                dealName: deal.dealName,
                monthlySubscription: Number(deal.monthlySubscription || 0),
                revenue: Number(deal.revenue || 0),
                duration: deal.duration,
                startDate: deal.startDate,
                closedDate: deal.closedDate,
                terminatedAt: deal.terminatedAt,
                bdId: deal.bdId,
                bd: deal.bd,
                client: deal.client,
                payments: deal.payments.map((payment) => ({
                    id: payment.id,
                    amount: Number(payment.amount),
                    date: payment.date ?? null,
                })),
            })),
            { year, quarter }
        )

        return { status: 200, body: overview }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to build payments overview', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
