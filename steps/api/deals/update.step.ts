import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

const bodySchema = z.object({
  dealName: z.string().max(255).optional(),
  remarks: z.string().optional(),
  actionPlan: z.string().optional(),
  actionPlanDueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  // dueDate is NOT accepted from client — always auto-computed from startDate + duration
  proposalLink: z.url().nullable().optional(),
  contractLink: z.url().nullable().optional(),
  finalProposedValue: z.number().nullable().optional(),
  monthlySubscription: z.number().positive().optional(),
  duration: z.number().int().positive().optional(),
  lastFollowUpAt: z.string().optional(),
  leadSource: z.enum(['INBOUND', 'OUTBOUND', 'REFERRAL']).optional(),
})

export const config = {
  name: 'UpdateDeal',
  description: 'Update deal fields — excludes stage changes (use the stage endpoint)',
  triggers: [
    { type: 'http' as const, path: '/api/deals/:id', method: 'PATCH' as const, bodySchema },
  ],
  enqueues: ['deal.updated'],
  flows: ['deals'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger, enqueue }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams
  const body = req.body

  const existing = await prisma.deal.findUnique({ where: { id } })
  if (!existing) return { status: 404, body: { error: 'Deal not found' } }
  if (!requireManager(user!.role) && existing.bdId !== user!.id) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const data: Record<string, unknown> = {}
  if (body.dealName !== undefined) data.dealName = body.dealName
  if (body.remarks !== undefined) data.remarks = body.remarks
  if (body.actionPlan !== undefined) data.actionPlan = body.actionPlan
  if (body.proposalLink !== undefined) data.proposalLink = body.proposalLink
  if (body.contractLink !== undefined) data.contractLink = body.contractLink
  if (body.finalProposedValue !== undefined) data.finalProposedValue = body.finalProposedValue
  if (body.lastFollowUpAt !== undefined) data.lastFollowUpAt = new Date(body.lastFollowUpAt)
  if (body.leadSource !== undefined) data.leadSource = body.leadSource
  if (body.actionPlanDueDate !== undefined) {
    data.actionPlanDueDate = body.actionPlanDueDate ? new Date(body.actionPlanDueDate) : null
  }

  // startDate — always recompute dueDate when startDate or duration changes
  const newStartDate = body.startDate !== undefined
    ? (body.startDate ? new Date(body.startDate) : null)
    : existing.startDate
  const newDuration = body.duration ?? existing.duration

  if (body.startDate !== undefined) data.startDate = newStartDate

  // Auto-compute dueDate = startDate + duration - 1 day (contract end date)
  if (body.startDate !== undefined || body.duration !== undefined) {
    if (newStartDate && newDuration) {
      const d = new Date(newStartDate)
      d.setMonth(d.getMonth() + newDuration)
      d.setDate(d.getDate() - 1)
      data.dueDate = d
    } else {
      data.dueDate = null
    }
  }

  if (body.monthlySubscription !== undefined || body.duration !== undefined) {
    const sub = body.monthlySubscription ?? Number(existing.monthlySubscription)
    const dur = newDuration
    const revenue = sub * dur
    data.monthlySubscription = sub
    data.duration = dur
    data.revenue = revenue

    await prisma.dealProjection.update({
      where: { dealId: id },
      data: { projectedAmount: revenue, weightedValue: revenue * (Number(existing.monthlySubscription) / 100) },
    })
  }

  const deal = await prisma.deal.update({ where: { id }, data })

  await enqueue({
    topic: 'deal.updated', data: {
      deal_id: id,
      bd_id: existing.bdId,
      deal_name: existing.dealName,
      fields_changed: Object.keys(data),
      manager_notified: requireManager(user!.role) && existing.bdId !== user!.id,
    }
  })

  logger.info('Deal updated', { dealId: id })
  return { status: 200, body: { deal } }
}