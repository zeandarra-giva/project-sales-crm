import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'
import { Prisma } from '@prisma/client'

export const config = {
    name: 'UpdateDeal',
    description: 'Update an existing deal (fields only — stage transitions go through /stage endpoint)',
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
                startDate: z.string().datetime().optional(),
                // remarks/actionPlan now live on DealAuditLog (Rev 1–2)
                // These update the CURRENT open audit log entry (exitedAt IS NULL)
                remarks: z.string().optional(),
                actionPlan: z.string().optional(),
                actionPlanDueDate: z.string().datetime().optional(),
                dueDate: z.string().datetime().optional(),
                proposalLink: z.string().url().optional(),
                contractLink: z.string().url().optional(),
                primaryContactId: z.string().uuid().nullable().optional(),
            }),
        },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, _ctx) => {
    try {
        const user = await authenticate(req.request)
        const { id } = req.request.pathParams
        const {
            stageId,
            remarks,
            actionPlan,
            actionPlanDueDate,
            monthlySubscription,
            duration,
            primaryContactId,
            ...rest
        } = req.request.body

        // 1. Fetch current deal + target stage if changing
        const deal = await prisma.deal.findUnique({
            where: { id },
            include: { stage: true }
        })

        if (!deal) {
            return { status: 404, body: { error: 'Deal not found' } }
        }

        // BD Reps can only edit their own deals
        if (user.role !== 'SALES_MANAGER' && deal.bdId !== user.id) {
            return { status: 403, body: { error: 'You can only manage your own deals' } }
        }

        if (deal.contractStatus === 'TERMINATED' && stageId && stageId !== deal.stageId) {
            return { status: 400, body: { error: 'Terminated contracts cannot move through the pipeline.' } }
        }

        let targetStageName = ''
        if (stageId && stageId !== deal.stageId) {
            const targetStage = await prisma.pipelineStage.findUnique({
                where: { id: stageId }
            })
            if (!targetStage) {
                return { status: 400, body: { error: 'Target stage not found — check stageId' } }
            }
            targetStageName = targetStage.name
        }

        // 2. Business rule: If moving to Closed Lost, require remarks on current audit log
        if (targetStageName === 'Closed Lost' && !remarks) {
            // Check if there's already a remark on the current audit log
            const currentLog = await prisma.dealAuditLog.findFirst({
                where: { dealId: id, exitedAt: null },
                orderBy: { enteredAt: 'desc' },
            })
            if (!currentLog?.remarks) {
                return {
                    status: 400,
                    body: { error: 'Remarks (Loss Reason) are required when closing a deal as lost' }
                }
            }
        }

        if (primaryContactId !== undefined && primaryContactId !== null) {
            const selectedContact = await prisma.contact.findFirst({
                where: { id: primaryContactId, clientId: deal.clientId },
                select: { id: true },
            })

            if (!selectedContact) {
                return { status: 400, body: { error: 'Selected primary contact does not belong to this deal client.' } }
            }
        }

        // 3. Prepare Deal update data (no remarks/actionPlan — those are on audit log)
        const updateData: any = { ...rest }

        // Handle computed revenue if fields changed
        if (monthlySubscription !== undefined || duration !== undefined) {
            const newMonthly = monthlySubscription ?? Number(deal.monthlySubscription)
            const newDuration = duration ?? deal.duration
            updateData.monthlySubscription = newMonthly
            updateData.duration = newDuration
            updateData.revenue = newMonthly * newDuration
        }

        if (stageId && stageId !== deal.stageId) {
            const now = new Date()
            updateData.stageId = stageId
            updateData.lastStageUpdateAt = now

            if (targetStageName === 'Closed Won' || targetStageName === 'Closed Lost') {
                updateData.isClosed = true
                updateData.closedDate = now
                if (deal.startDate) {
                    updateData.salesCycleDays = Math.max(
                        0,
                        Math.floor((now.getTime() - deal.startDate.getTime()) / 86400000)
                    )
                }
            } else {
                updateData.isClosed = false
                updateData.closedDate = null
                updateData.salesCycleDays = null
            }
        }

        // 4. Update deal + audit log atomically
        const updatedDeal = await prisma.$transaction(async (tx) => {
            const updated = await tx.deal.update({
                where: { id },
                data: updateData,
                include: {
                    stage: true,
                    client: true,
                    bd: {
                        select: { id: true, firstName: true, lastName: true }
                    },
                    dealContacts: {
                        include: {
                            contact: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    email: true,
                                    number: true,
                                    designation: true,
                                },
                            },
                        },
                        orderBy: { isPrimary: 'desc' },
                    },
                    auditLogs: {
                        where: { exitedAt: null },
                        take: 1,
                        orderBy: { enteredAt: 'desc' },
                    },
                }
            })

            // 5. Update remarks/actionPlan on current open audit log row (Rev 1–3)
            if (remarks !== undefined || actionPlan !== undefined || actionPlanDueDate !== undefined) {
                await tx.dealAuditLog.updateMany({
                    where: { dealId: id, exitedAt: null },
                    data: {
                        ...(remarks !== undefined && { remarks }),
                        ...(actionPlan !== undefined && { actionPlan }),
                        ...(actionPlanDueDate !== undefined && {
                            actionPlanDueDate: new Date(actionPlanDueDate),
                        }),
                    },
                })
            }

            if (primaryContactId !== undefined) {
                await tx.dealContact.updateMany({
                    where: { dealId: id },
                    data: { isPrimary: false },
                })

                if (primaryContactId !== null) {
                    const existingDealContact = await tx.dealContact.findFirst({
                        where: { dealId: id, contactId: primaryContactId },
                        select: { id: true },
                    })

                    if (existingDealContact) {
                        await tx.dealContact.update({
                            where: { id: existingDealContact.id },
                            data: { isPrimary: true },
                        })
                    } else {
                        await tx.dealContact.create({
                            data: {
                                dealId: id,
                                contactId: primaryContactId,
                                isPrimary: true,
                            },
                        })
                    }
                }
            }

            // 6. Record history in DealAuditLog if stage changed via this endpoint
            if (stageId && stageId !== deal.stageId) {
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
                        notes: `Moved from ${deal.stage.name} to ${targetStageName}`,
                        remarks: remarks,
                        actionPlan: actionPlan,
                        actionPlanDueDate: actionPlanDueDate ? new Date(actionPlanDueDate) : null,
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
