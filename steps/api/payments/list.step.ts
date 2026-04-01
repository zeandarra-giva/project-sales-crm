import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { buildCollectionsOverview } from '../../../lib/paymentsCollections'

export const config = {
    name: 'ListPayments',
    description: 'List payments with optional deal, BD, year, and quarter filters',
    triggers: [
        { type: 'http', method: 'GET', path: '/api/payments' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)

        const dealId = req.request.queryParams?.dealId as string | undefined
        const requestedBdId = req.request.queryParams?.bdId as string | undefined
        const year = req.request.queryParams?.year ? Number(req.request.queryParams.year) : undefined
        const quarter = req.request.queryParams?.quarter ? Number(req.request.queryParams.quarter) : undefined

        if (requestedBdId && user.role !== 'SALES_MANAGER' && requestedBdId !== user.id) {
            return { status: 403, body: { error: 'You can only view your own payment logs' } }
        }

        const scopedBdId = user.role === 'SALES_MANAGER' ? requestedBdId : user.id

        const payments = await prisma.payment.findMany({
            where: {
                ...(dealId ? { dealId } : {}),
                ...(scopedBdId ? { deal: { bdId: scopedBdId } } : {}),
            },
            include: {
                deal: {
                    select: {
                        id: true,
                        dealName: true,
                        bdId: true,
                        bd: { select: { id: true, firstName: true, lastName: true } },
                        client: { select: { id: true, name: true, accountType: true } },
                    },
                },
                date: { select: { year: true, month: true, quarter: true } },
            },
            orderBy: [{ date: { year: 'desc' } }, { date: { month: 'desc' } }],
        })

        const normalizedDeals = new Map<string, any>()
        for (const payment of payments) {
            if (!normalizedDeals.has(payment.deal.id)) {
                normalizedDeals.set(payment.deal.id, {
                    id: payment.deal.id,
                    dealName: payment.deal.dealName,
                    monthlySubscription: 0,
                    revenue: 0,
                    duration: 0,
                    startDate: null,
                    bdId: payment.deal.bdId,
                    bd: payment.deal.bd,
                    client: payment.deal.client,
                    payments: [],
                })
            }
            normalizedDeals.get(payment.deal.id).payments.push({
                id: payment.id,
                amount: Number(payment.amount),
                date: payment.date ?? null,
            })
        }

        const overview = buildCollectionsOverview(Array.from(normalizedDeals.values()), { year, quarter })
        const filteredLogs = overview.logs.filter((payment) => {
            if (dealId && payment.dealId !== dealId) return false
            if (scopedBdId && payment.bdId !== scopedBdId) return false
            if (year && payment.billingYear !== year) return false
            if (quarter && payment.billingQuarter !== quarter) return false
            return true
        })

        return {
            status: 200,
            body: filteredLogs,
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to list payments', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
