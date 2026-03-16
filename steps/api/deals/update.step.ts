import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'
import { Prisma } from '@prisma/client'

export const config = {
    name: 'UpdateDeal',
    description: 'Update an existing deal',
    triggers: [
        {
            type: 'http' as const,
            method: 'PATCH' as const,
            path: '/api/deals/:id',
            bodySchema: z.object({
                dealName: z.string().min(1).optional(),
                monthlySubscription: z.number().min(0).optional(),
                duration: z.number().min(1).optional(),
                stageId: z.string().uuid().optional(),
                remarks: z.string().optional(),
                actionPlan: z.string().optional(),
                dueDate: z.string().datetime().optional(),
                proposalLink: z.string().url().optional(),
                contractLink: z.string().url().optional(),
            }),
        },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams
        const { stageId, remarks, monthlySubscription, duration, ...rest } = req.request.body

        // 1. Fetch current deal + target stage if changing
        const deal = await prisma.deal.findUnique({
            where: { id },
            include: { stage: true }
        })

        if (!deal) {
            return { status: 404, body: { error: 'Deal not found' } }
        }

        let targetStageName = ""
        if (stageId && stageId !== deal.stageId) {
            const targetStage = await prisma.pipelineStage.findUnique({
                where: { id: stageId }
            })
            if (!targetStage) {
                return { status: 400, body: { error: 'Target stage not found — check stageId' } }
            }
            targetStageName = targetStage.name
        }

        // 2. Business rule: If moving to Closed Lost, require remarks
        if (targetStageName === 'Closed Lost' && !remarks && !deal.remarks) {
            return {
                status: 400,
                body: { error: 'Remarks (Loss Reason) are required when closing a deal as lost' }
            }
        }

        // 3. Prepare Update Data
        const updateData: any = {
            ...rest,
            remarks: remarks || deal.remarks,
        }

        // Handle computed revenue if fields changed
        if (monthlySubscription !== undefined || duration !== undefined) {
            const newMonthly = monthlySubscription ?? Number(deal.monthlySubscription)
            const newDuration = duration ?? deal.duration
            updateData.monthlySubscription = newMonthly
            updateData.duration = newDuration
            updateData.revenue = newMonthly * newDuration
        }

        if (stageId && stageId !== deal.stageId) {
            updateData.stageId = stageId
            updateData.lastStageUpdateAt = new Date()

            if (targetStageName === 'Closed Won' || targetStageName === 'Closed Lost') {
                updateData.isClosed = true
                updateData.closedDate = new Date()
            } else {
                updateData.isClosed = false
                updateData.closedDate = null
            }
        }

        // 4. Update deal + audit logs atomically
        const updatedDeal = await prisma.$transaction(async (tx) => {
            const updated = await tx.deal.update({
                where: { id },
                data: updateData,
                include: {
                    stage: true,
                    client: true,
                    bd: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            })

            // 5. Record history in DealAuditLog if stage changed
            if (stageId && stageId !== deal.stageId) {
                // Close out the previous audit log entry
                await tx.dealAuditLog.updateMany({
                    where: { dealId: id, exitedAt: null },
                    data: { exitedAt: new Date() }
                })

                await tx.dealAuditLog.create({
                    data: {
                        dealId: id,
                        stageId: stageId,
                        changedById: user.id,
                        enteredAt: new Date(),
                        notes: remarks || `Moved from ${deal.stage.name} to ${targetStageName}`
                    }
                })
            }

            return updated
        })

        logger.info('Updated deal', { dealId: id, by: user.id })

        return {
            status: 200,
            body: updatedDeal,
        }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error.code === 'P2025' || error.code === 'P2003')
        ) {
            return { status: 400, body: { error: 'Record not found or invalid ID provided' } }
        }

        logger.error('Failed to update deal', { error: error.message, dealId: req.request.pathParams.id })
        return {
            status: 500,
            body: { error: 'Internal server error' },
        }
    }
}
