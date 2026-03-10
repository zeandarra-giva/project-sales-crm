import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

const bodySchema = z.object({
  dealId: z.string().uuid(),
  amount: z.number().positive(),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
})

export const config = {
  name: 'CreatePayment',
  description: 'Log a monthly payment against a deal — auto-creates a DateDimension record',
  triggers: [{ type: 'http' as const, path: '/api/payments', method: 'POST' as const, bodySchema }],
  enqueues: [],
  flows: ['payments'],
} satisfies StepConfig

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { dealId, amount, year, month } = req.body

  const deal = await prisma.deal.findUnique({ where: { id: dealId } })
  if (!deal) return { status: 404, body: { error: 'Deal not found' } }
  if (!requireManager(user!.role) && deal.bdId !== user!.id) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  // Use the 1st of the given month as the canonical date
  const ts = new Date(year, month - 1, 1)
  const quarter = Math.ceil(month / 3)

  // Upsert DateDimension so duplicate month entries reuse the same record
  const dateDim = await prisma.dateDimension.upsert({
    where: { id: `${year}-${String(month).padStart(2, '0')}` },
    update: {},
    create: {
      id: `${year}-${String(month).padStart(2, '0')}`,
      timestamp: ts,
      year,
      month,
      monthNumber: month,
      day: 1,
      dayOfWeek: DAY_NAMES[ts.getDay()],
      quarter,
      isQuarterEnd: month % 3 === 0,
    },
  })

  const payment = await prisma.payment.create({
    data: { dealId, amount, dateId: dateDim.id },
    include: {
      date: true,
      deal: { select: { id: true, dealName: true, client: { select: { name: true } } } },
    },
  })

  logger.info('Payment created', { paymentId: payment.id, dealId, year, month })
  return { status: 201, body: { payment } }
}