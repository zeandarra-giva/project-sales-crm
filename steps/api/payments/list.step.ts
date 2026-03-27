import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'

export const config = {
    name: 'ListPayments',
    description: 'List payments — optionally filtered by dealId',
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

        // Scoping rules:
        //   BD Rep  → sees only their own deals' payments
        //   Manager → sees all, or filters by dealId
        const whereClause = dealId
            ? { dealId }
            : user.role === 'SALES_MANAGER'
            ? {}
            : { deal: { bdId: user.id } }

        const payments = await prisma.payment.findMany({
            where: whereClause,
            include: {
                deal: { select: { id: true, dealName: true } },
                date: { select: { year: true, month: true, quarter: true } },
            },
            orderBy: { deal: { dealName: 'asc' } },
        })

        return {
            status: 200,
            body: payments.map((p) => ({
                id: p.id,
                amount: Number(p.amount),
                dealId: p.dealId,
                deal: p.deal,
                date: p.date ?? null,
            })),
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to list payments', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
