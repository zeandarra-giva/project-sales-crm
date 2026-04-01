import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

export const config = {
    name: 'CreatePayment',
    description: 'Record a payment against a deal',
    triggers: [
        { type: 'http', method: 'POST', path: '/api/payments' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

const CreatePaymentSchema = z.object({
    dealId: z.string().uuid('Invalid deal ID'),
    amount: z.number().positive('Amount must be greater than 0'),
    dateId: z.string().uuid().optional(),
    billingYear: z.number().int().min(2000).max(2100).optional(),
    billingMonth: z.number().int().min(1).max(12).optional(),
})

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)

        const parsed = CreatePaymentSchema.safeParse(req.request.body)
        if (!parsed.success) {
            return {
                status: 400,
                body: { error: 'Validation failed', details: parsed.error.flatten() },
            }
        }

        const { dealId, amount, dateId, billingYear, billingMonth } = parsed.data

        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: {
                stage: { select: { name: true } },
            },
        })

        if (!deal) {
            return { status: 404, body: { error: 'Deal not found' } }
        }

        if (deal.stage.name !== 'Closed Won' && !deal.isClosed) {
            return { status: 400, body: { error: 'Payments can only be recorded against closed deals' } }
        }

        if (user.role !== 'SALES_MANAGER' && deal.bdId !== user.id) {
            return { status: 403, body: { error: 'You can only record payments against your own deals' } }
        }

        let resolvedDateId = dateId
        if (!resolvedDateId && billingYear && billingMonth) {
            const dateRow = await prisma.dateDimension.findFirst({
                where: {
                    year: billingYear,
                    month: billingMonth,
                    day: 1,
                },
                select: { id: true },
            })
            if (!dateRow) {
                return { status: 400, body: { error: 'Billing period not found in date dimension' } }
            }
            resolvedDateId = dateRow.id
        }

        const payment = await prisma.payment.create({
            data: {
                dealId,
                amount: new Prisma.Decimal(amount),
                ...(resolvedDateId ? { dateId: resolvedDateId } : {}),
            },
            include: {
                deal: {
                    select: {
                        id: true,
                        dealName: true,
                        bdId: true,
                        bd: { select: { firstName: true, lastName: true } },
                        client: { select: { name: true } },
                    },
                },
                date: { select: { year: true, month: true, quarter: true } },
            },
        })

        return {
            status: 201,
            body: {
                id: payment.id,
                amount: Number(payment.amount),
                dealId: payment.dealId,
                deal: payment.deal,
                date: payment.date ?? null,
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to create payment', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
