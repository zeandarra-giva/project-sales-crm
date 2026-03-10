import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'
import { getProbability, getStageByName, STAGE } from '../../../lib/pipeline.js'

const bodySchema = z.object({
  dealName: z.string().min(1).max(255),
  monthlySubscription: z.number().positive(),
  duration: z.number().int().positive(),
  leadSource: z.enum(['INBOUND', 'OUTBOUND', 'REFERRAL']),
  clientId: z.uuid(),
  serviceId: z.uuid().optional(),
  bundleId: z.uuid().optional(),
  remarks: z.string().optional(),
  actionPlan: z.string().optional(),
  dueDate: z.string().optional(),
  actionPlanDueDate: z.string().optional(),
  initialMeetingDate: z.string().optional(),
})

export const config = {
  name: 'CreateDeal',
  description: 'Create a new deal — auto-sets stage to Inquiry, creates audit log and projection',
  triggers: [{ type: 'http' as const, path: '/api/deals', method: 'POST' as const, bodySchema }],
  enqueues: ['deal.created'],
  flows: ['deals'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger, enqueue }) => {
  const { error, status, user } = await authenticate(req)
  if (error) return { status, body: { error } }

  const body = req.body
  if ((!body.serviceId && !body.bundleId) || (body.serviceId && body.bundleId)) {
    return { status: 400, body: { error: 'Provide exactly one of serviceId or bundleId' } }
  }

  const inquiryStage = await getStageByName(STAGE.INQUIRY)
  const revenue = body.monthlySubscription * body.duration
  const probability = getProbability(STAGE.INQUIRY)

  const deal = await prisma.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        dealName: body.dealName,
        monthlySubscription: body.monthlySubscription,
        duration: body.duration,
        revenue,
        stageId: inquiryStage.id,
        leadSource: body.leadSource,
        clientId: body.clientId,
        bdId: user!.id,
        serviceId: body.serviceId,
        bundleId: body.bundleId,
        remarks: body.remarks,
        actionPlan: body.actionPlan,
        startDate: new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        actionPlanDueDate: body.actionPlanDueDate ? new Date(body.actionPlanDueDate) : undefined,
        initialMeetingDate: body.initialMeetingDate ? new Date(body.initialMeetingDate) : undefined,
      },
    })

    await tx.dealAuditLog.create({
      data: {
        dealId: deal.id,
        stageId: inquiryStage.id,
        changedById: user!.id,
        enteredAt: new Date(),
        notes: 'Deal created',
      },
    })

    await tx.dealProjection.create({
      data: {
        dealId: deal.id,
        bdId: user!.id,
        projectedAmount: revenue,
        probabilityPct: probability,
        weightedValue: revenue * (probability / 100),
      },
    })

    return deal
  })

  await enqueue({
    topic: 'deal.created',
    data: { deal_id: deal.id, bd_id: user!.id, deal_name: deal.dealName, created_by_id: user!.id },
  })

  logger.info('Deal created', { dealId: deal.id })
  return { status: 201, body: { deal } }
}
