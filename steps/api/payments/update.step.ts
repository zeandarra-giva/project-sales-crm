import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

const bodySchema = z.object({
  amount: z.number().min(0), // 0 = nothing received this month
})

export const config = {
  name: 'UpdatePayment',
  description: 'Update the received amount for a payment month. Month/date is fixed — only amount can change.',
  triggers: [{ type: 'http' as const, path: '/api/payments/:id', method: 'PATCH' as const, bodySchema }],
  enqueues: [],
  flows: ['payments'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams
  const { amount } = req.body

  const existing = await prisma.payment.findUnique({
    where: { id },
    include: {
      deal: {
        select: {
          bdId: true, revenue: true, monthlySubscription: true, duration: true,
        },
      },
    },
  })
  if (!existing) return { status: 404, body: { error: 'Payment not found' } }
  if (!requireManager(user!.role) && existing.deal.bdId !== user!.id) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const payment = await prisma.payment.update({
    where: { id },
    data: { amount },
    include: {
      date: true,
      deal: { select: { id: true, dealName: true, client: { select: { name: true } } } },
    },
  })

  logger.info('Payment amount updated', { paymentId: id, amount })
  return { status: 200, body: { payment } }
}