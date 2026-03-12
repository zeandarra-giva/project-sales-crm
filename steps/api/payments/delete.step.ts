import { type Handlers, type StepConfig } from 'motia'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'DeletePayment',
  description: 'Delete a payment record',
  triggers: [{ type: 'http' as const, path: '/api/payments/:id', method: 'DELETE' as const }],
  enqueues: [],
  flows: ['payments'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams

  const existing = await prisma.payment.findUnique({
    where: { id },
    include: { deal: true },
  })
  if (!existing) return { status: 404, body: { error: 'Payment not found' } }
  if (!requireManager(user!.role) && existing.deal.bdId !== user!.id) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  await prisma.payment.delete({ where: { id } })

  logger.info('Payment deleted', { paymentId: id })
  return { status: 200, body: { message: 'Payment deleted' } }
}