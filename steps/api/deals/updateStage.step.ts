import { type Handlers, type StepConfig, logger, enqueue } from 'motia'
import { z } from 'zod'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'
import { Prisma } from '@prisma/client'

// PRD Section 7 — Stage probabilities (Inquiry 10% → Closed Won 100%)
const STAGE_PROBABILITY: Record<string, number> = {
    'Inquiry': 10,
    'Prospecting': 20,
    'Discovery': 40,
    'Proposal Sent': 60,
    'Negotiation': 75,
    'Closed Won': 100,
    'Closed Lost': 0,
}

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
        const { stageId, remarks, actionPlan, notes } = req.request.body

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

        // ── 3. Business rule: Closed Lost requires meaningful remarks (FR-ADD-004) ──
        if (targetStage.name === 'Closed Lost' && !remarks.trim()) {
            return {
                status: 400,
                body: {
                    error: 'Remarks must explain why the deal was lost before moving to Closed Lost.',
                },
            }
        }

        const isClosed = ['Closed Won', 'Closed Lost'].includes(targetStage.name)
        const newProbability = STAGE_PROBABILITY[targetStage.name] ?? 0

        // ── 4. Atomic transaction: audit log + deal update + projection ──
        const updatedDeal = await prisma.$transaction(async (tx) => {

            // 4a. Close the current open audit log row (FR-D08)
            await tx.dealAuditLog.updateMany({
                where: { dealId: id, exitedAt: null },
                data: { exitedAt: new Date() },
            })

            // 4b. Open a new audit log row — includes remarks + action plan in notes
            const auditNote = [
                notes || `Moved from ${deal.stage.name} to ${targetStage.name}`,
                `Remarks: ${remarks}`,
                `Action Plan: ${actionPlan}`,
            ].join('\n')

            await tx.dealAuditLog.create({
                data: {
                    dealId: id,
                    stageId,
                    changedById: user.id,
                    enteredAt: new Date(),
                    notes: auditNote,
                },
            })

            // 4c. Update the deal's stage + remarks + action plan + timestamps (FR-D10)
            const dealUpdateData: Prisma.DealUpdateInput = {
                stage: { connect: { id: stageId } },
                remarks,
                actionPlan,
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
                },
            })

            // 4d. Update deal projection probability (FR-D11)
            await tx.dealProjection.updateMany({
                where: { dealId: id },
                data: {
                    probabilityPct: newProbability,
                    weightedValue: Number(deal.revenue || 0) * (newProbability / 100),
                },
            })

            return updated
        })

        // ── 5. Enqueue event — consumed by onDealStageChanged.step.ts (Day 4) ──
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
