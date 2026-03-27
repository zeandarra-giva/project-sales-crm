import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { z } from 'zod'

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
    // dateId is optional — links to DateDimension if provided
    dateId: z.string().uuid().optional(),
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

        const { dealId, amount, dateId } = parsed.data

        // Verify deal exists and belongs to this BD (managers can record against any deal)
        const deal = await prisma.deal.findUnique({ where: { id: dealId } })

        if (!deal) {
            return { status: 404, body: { error: 'Deal not found' } }
        }

        if (user.role !== 'SALES_MANAGER' && deal.bdId !== user.id) {
            return { status: 403, body: { error: 'You can only record payments against your own deals' } }
        }

        const payment = await prisma.payment.create({
            data: {
                dealId,
                amount,
                ...(dateId ? { dateId } : {}),
            },
            include: {
                deal: { select: { id: true, dealName: true } },
            },
        })

        return {
            status: 201,
            body: {
                ...payment,
                amount: Number(payment.amount),
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
