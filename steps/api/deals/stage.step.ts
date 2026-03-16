import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { authenticate, requireManager } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { getProbability, isClosedStage, getStageByName } from '../../../lib/pipeline.js'

const bodySchema = z.object({
  stageName: z.string().min(1),
  remarks: z.string().min(1, 'Remarks are required'),
  actionPlan: z.string().min(1, 'Action plan is required'),
  actionPlanDueDate: z.string().min(1, 'Action plan due date is required'),
  notes: z.string().optional(),
  finalProposedValue: z.number().optional(),
  contractLink: z.string().optional(),
})

export const config = {
  name: 'ChangeDealStage',
  description: 'Move a deal to a new pipeline stage — closes current audit log, opens new one, updates projection',
  triggers: [
    { type: 'http' as const, path: '/api/deals/:id/stage', method: 'PATCH' as const, bodySchema },
  ],
  enqueues: ['deal.stage.changed', 'deal.closed.won', 'deal.closed.lost'],
  flows: ['deals', 'notifications'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger, enqueue }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams
  const { stageName, notes, remarks, actionPlan, actionPlanDueDate, finalProposedValue, contractLink } = req.body

  const [deal, newStage] = await Promise.all([
    prisma.deal.findUnique({
      where: { id },
      include: {
        stage: true,
        auditLogs: { where: { exitedAt: null }, orderBy: { enteredAt: 'desc' }, take: 1 },
      },
    }),
    getStageByName(stageName),
  ])

  if (!deal) return { status: 404, body: { error: 'Deal not found' } }
  if (!requireManager(user!.role) && deal.bdId !== user!.id) {
    return { status: 403, body: { error: 'Forbidden' } }
  }
  if (deal.stageId === newStage.id) {
    return { status: 400, body: { error: `Deal is already in stage: ${stageName}` } }
  }

  const isClosed = isClosedStage(stageName)

  // Require contract dates from Proposal Sent onward
  const stagesRequiringDates = ['Proposal Sent', 'Negotiation', 'Closed Won']
  if (stagesRequiringDates.includes(stageName)) {
    const missing: string[] = []
    if (!deal.startDate) missing.push('Contract Start Date')
    if (!deal.dueDate) missing.push('Expected Close Date')
    if (missing.length > 0) {
      return {
        status: 422,
        body: { error: `Please fill in ${missing.join(' and ')} on the deal before moving to "${stageName}".` },
      }
    }
  }

  const now = new Date()
  const probability = getProbability(stageName)

  const updatedDeal = await prisma.$transaction(async (tx) => {
    // Close current open audit log
    const currentLog = deal.auditLogs[0]
    if (currentLog) {
      const daysInStage = Math.floor((now.getTime() - currentLog.enteredAt.getTime()) / 86400000)
      await tx.dealAuditLog.update({
        where: { id: currentLog.id },
        data: { exitedAt: now, daysInStage },
      })
    }

    // Open new audit log with required fields
    await tx.dealAuditLog.create({
      data: {
        dealId: id,
        stageId: newStage.id,
        changedById: user!.id,
        enteredAt: now,
        notes: notes ?? null,
        remarks: remarks.trim(),
        actionPlan: actionPlan.trim(),
        actionPlanDueDate: new Date(actionPlanDueDate),
      } as any,
    })

    const dealUpdate: Record<string, unknown> = {
      stageId: newStage.id,
      lastStageUpdateAt: now,
      isClosed,
    }
    if (isClosed) {
      dealUpdate.closedDate = now
      dealUpdate.salesCycleDays = Math.floor((now.getTime() - (deal.startDate ?? now).getTime()) / 86400000)
    }
    if (stageName === 'Closed Lost' && finalProposedValue !== undefined) {
      dealUpdate.finalProposedValue = finalProposedValue
    }
    if (stageName === 'Closed Won' && contractLink) {
      dealUpdate.contractLink = contractLink
    }

    const updated = await tx.deal.update({ where: { id }, data: dealUpdate })

    await tx.dealProjection.update({
      where: { dealId: id },
      data: {
        probabilityPct: probability,
        weightedValue: Number(updated.revenue ?? 0) * (probability / 100),
      },
    })

    return updated
  })

  await enqueue({
    topic: 'deal.stage.changed', data: {
      deal_id: id,
      bd_id: deal.bdId,
      deal_name: deal.dealName,
      old_stage: deal.stage.name,
      new_stage: stageName,
    }
  })

  if (stageName === 'Closed Won') {
    await enqueue({ topic: 'deal.closed.won', data: { deal_id: id, bd_id: deal.bdId } })
  }
  if (stageName === 'Closed Lost') {
    await enqueue({
      topic: 'deal.closed.lost', data: {
        deal_id: id, bd_id: deal.bdId, deal_name: deal.dealName, closing_notes: notes,
      }
    })
  }

  logger.info('Deal stage changed', { dealId: id, from: deal.stage.name, to: stageName })
  return { status: 200, body: { deal: updatedDeal } }
}