import { type Handlers, type StepConfig } from 'motia'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'GetPayments',
  description: 'List payment records',
  triggers: [{ type: 'http' as const, path: '/api/payments', method: 'GET' as const }],
  enqueues: [],
  flows: ['payments'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const q = req.queryParams as Record<string, string>
  const dealFilter: Record<string, unknown> = {}
  if (!requireManager(user!.role)) dealFilter.bdId = user!.id
  if (q.deal_id) dealFilter.id = q.deal_id

  const payments = await prisma.payment.findMany({
    where: { deal: dealFilter },
    include: {
      date: true,
      deal: {
        select: {
          id: true, dealName: true, revenue: true,
          bd: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { name: true } },
          stage: { select: { name: true } },
          monthlySubscription: true,
          duration: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  })

  const totalReceived = payments.reduce((s, p) => s + Number(p.amount), 0)
  logger.info('Payments fetched', { count: payments.length })
  return { status: 200, body: { payments, totalReceived } }
}