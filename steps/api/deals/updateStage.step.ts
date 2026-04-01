import { type Handlers, type StepConfig, logger, enqueue } from 'motia'
import { z } from 'zod'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'
import { Prisma } from '@prisma/client'

export const config = {
    name: 'UpdateDealStage',
    description: 'Move a deal to a new pipeline stage with atomic audit log tracking (FR-D07 to FR-D11)',
    triggers: [
        {
            type: 'http' as const,
            method: 'PATCH' as const,
            path: '/api/deals/:id/stage',
            bodySchema: z.object({
                stageId: z.string().uuid(),
                remarks: z.string().min(1, 'Remarks are required when moving a deal'),
                actionPlan: z.string().min(1, 'Action plan is required when moving a deal'),
                actionPlanDueDate: z.string().datetime().optional(),
                notes: z.string().optional(),
            }),
        },
    ],
    enqueues: ['deal.stage.changed'],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams
        const { stageId, remarks, actionPlan, actionPlanDueDate, notes } = req.request.body

        // ── 1. Fetch current deal + its stage ──
        const deal = await prisma.deal.findUnique({
            where: { id },
            include: { stage: true },
        })

        if (!deal) {
            return { status: 404, body: { error: 'Deal not found' } }
        }

        // BD Reps can only move their own deals (FR-PRE-002)
        if (user.role !== 'SALES_MANAGER' && deal.bdId !== user.id) {
            return { status: 403, body: { error: 'You can only manage your own deals' } }
        }

        if (deal.contractStatus === 'TERMINATED') {
            return { status: 400, body: { error: 'Terminated contracts cannot move through the pipeline.' } }
        }

        // No-op guard
        if (deal.stageId === stageId) {
            return { status: 200, body: { message: 'Deal is already at this stage' } }
        }

        // ── 2. Validate target stage exists ──
        const targetStage = await prisma.pipelineStage.findUnique({
            where: { id: stageId },
        })

        if (!targetStage) {
            return { status: 400, body: { error: 'Target stage not found — check stageId' } }
        }

        // ── 3a. Business rule: Closed Lost requires meaningful remarks (FR-ADD-004) ──
        if (targetStage.name === 'Closed Lost' && !remarks.trim()) {
            return {
                status: 400,
                body: {
                    error: 'Remarks must explain why the deal was lost before moving to Closed Lost.',
                },
            }
        }

        // ── 3b. Business rule: Closed Won requires a contract link (Rev 8) ──
        if (targetStage.name === 'Closed Won' && !deal.contractLink) {
            return {
                status: 400,
                body: {
                    error: 'A contract link must be attached to the deal before marking it as Closed Won.',
                },
            }
        }

        const isClosed = ['Closed Won', 'Closed Lost'].includes(targetStage.name)

        // ── 4. Atomic transaction: audit log + deal update ──
        const updatedDeal = await prisma.$transaction(async (tx) => {

            // 4a. Close the current open audit log row (FR-D08)
            await tx.dealAuditLog.updateMany({
                where: { dealId: id, exitedAt: null },
                data: { exitedAt: new Date() },
            })

            // 4b. Open a new audit log row with remarks + action plan (Rev 1–3)
            await tx.dealAuditLog.create({
                data: {
                    dealId: id,
                    stageId,
                    changedById: user.id,
                    enteredAt: new Date(),
                    notes: notes || `Moved from ${deal.stage.name} to ${targetStage.name}`,
                    remarks,
                    actionPlan,
                    actionPlanDueDate: actionPlanDueDate ? new Date(actionPlanDueDate) : null,
                },
            })

            // 4c. Update the deal's stage + timestamps (FR-D10)
            // remarks/actionPlan now live on DealAuditLog — NOT on Deal (Rev 1–2)
            const dealUpdateData: Prisma.DealUpdateInput = {
                stage: { connect: { id: stageId } },
                lastStageUpdateAt: new Date(),
                isClosed,
                ...(isClosed && { closedDate: new Date() }),
                // Capture final proposed value on Closed Lost (FR-ADD-005)
                ...(targetStage.name === 'Closed Lost' && {
                    finalProposedValue: deal.revenue,
                }),
            }

            const updated = await tx.deal.update({
                where: { id },
                data: dealUpdateData,
                include: {
                    stage: true,
                    bd: { select: { id: true, firstName: true, lastName: true } },
                    client: true,
                    service: true,
                    bundle: true,
                    auditLogs: {
                        where: { exitedAt: null },
                        take: 1,
                        orderBy: { enteredAt: 'desc' },
                    },
                },
            })

            // NOTE: DealProjection probability/weightedValue fields removed (Rev 5)
            // Forecast now uses Closed Won + 80% Negotiation formula in dashboard steps

            return updated
        })

        // ── 5. Enqueue event — consumed by onDealStageChanged.step.ts ──
        await enqueue({
            topic: 'deal.stage.changed',
            data: {
                dealId: id,
                dealName: deal.dealName,
                previousStageId: deal.stageId,
                previousStageName: deal.stage.name,
                newStageId: stageId,
                newStageName: targetStage.name,
                bdId: deal.bdId,
                changedById: user.id,
                isClosed,
            },
        })

        logger.info('Deal stage updated', {
            dealId: id,
            from: deal.stage.name,
            to: targetStage.name,
            by: user.id,
        })

        return { status: 200, body: updatedDeal }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error.code === 'P2025' || error.code === 'P2003')
        ) {
            return { status: 400, body: { error: 'Record not found or invalid reference' } }
        }
        logger.error('Failed to update deal stage', {
            error: error.message,
            dealId: req.request.pathParams.id,
        })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
