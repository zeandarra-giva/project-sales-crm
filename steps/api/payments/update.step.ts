import { type StepConfig, type Handlers, logger } from 'motia'
import { authenticate } from '../../../lib/auth'
import { prisma } from '../../../lib/db'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { createTeamNotification } from '../../../lib/notifications'

const UpdatePaymentSchema = z.object({
    amount: z.number().positive('Amount must be greater than 0').optional(),
    billingYear: z.number().int().min(2000).max(2100).optional(),
    billingMonth: z.number().int().min(1).max(12).optional(),
})

export const config = {
    name: 'UpdatePayment',
    description: 'Update an existing payment log',
    triggers: [
        { type: 'http', method: 'PATCH', path: '/api/payments/:id' },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        if (user.role !== 'SALES_MANAGER') {
            return { status: 403, body: { error: 'Only managers can edit payment logs' } }
        }

        const parsed = UpdatePaymentSchema.safeParse(req.request.body)
        if (!parsed.success) {
            return {
                status: 400,
                body: { error: 'Validation failed', details: parsed.error.flatten() },
            }
        }

        const { id } = req.request.pathParams
        const existing = await prisma.payment.findUnique({ where: { id } })
        if (!existing) {
            return { status: 404, body: { error: 'Payment not found' } }
        }

        const { amount, billingYear, billingMonth } = parsed.data
        let resolvedDateId: string | undefined
        if (billingYear && billingMonth) {
            const dateRow = await prisma.dateDimension.findFirst({
                where: { year: billingYear, month: billingMonth, day: 1 },
                select: { id: true },
            })
            if (!dateRow) {
                return { status: 400, body: { error: 'Billing period not found in date dimension' } }
            }
            resolvedDateId = dateRow.id
        }

        const updated = await prisma.payment.update({
            where: { id },
            data: {
                ...(amount !== undefined ? { amount: new Prisma.Decimal(amount) } : {}),
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

        await createTeamNotification({
            dealId: updated.dealId,
            type: 'FOLLOW_UP_DUE',
            triggeredBy: 'NO_FOLLOW_UP_IN_14_DAYS',
            content: `Payment log for "${updated.deal.dealName}" was updated${updated.date ? ` to ${updated.date.month}/${updated.date.year}` : ''}.`,
        }).catch((error) => logger.warn('Failed to create team payment-update notification', { error, paymentId: id }))

        return {
            status: 200,
            body: {
                id: updated.id,
                amount: Number(updated.amount),
                dealId: updated.dealId,
                deal: updated.deal,
                date: updated.date ?? null,
            },
        }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        logger.error('Failed to update payment', { error: error.message })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
