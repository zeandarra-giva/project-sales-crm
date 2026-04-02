import { type Handlers, type StepConfig, logger, enqueue } from 'motia'
import { z } from 'zod'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'
import { Prisma } from '@prisma/client'
import { createTeamNotification } from '../../../lib/notifications'

export const config = {
    name: 'CreateDeal',
    description: 'Create a new deal',
    triggers: [
        {
            type: 'http' as const,
            method: 'POST' as const,
            path: '/api/deals',
            bodySchema: z.object({
                dealName: z.string().min(1),
                clientId: z.string().min(1),
                monthlySubscription: z.number().min(0),
                duration: z.number().min(1),
                leadSource: z.enum(['INBOUND', 'OUTBOUND', 'REFERRAL']),
                contractStartDate: z.string().min(1),
                contractEndDate: z.string().min(1),
                primaryContactId: z.string().uuid().optional(),
                serviceId: z.string().optional(),
                bundleId: z.string().optional(),
                proposalLink: z.string().optional(),
                contractLink: z.string().optional(),
            }).refine(
                (body) => Boolean(body.serviceId || body.bundleId),
                {
                    message: 'A deal must be tied to a service or bundle.',
                    path: ['serviceId'],
                }
            ),
        },
    ],
    enqueues: [],
    flows: ['sales-pipeline'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        const user = await authenticate(req.request)

        const {
            dealName,
            clientId,
            monthlySubscription,
            duration,
            leadSource,
            contractStartDate,
            contractEndDate,
            primaryContactId,
            serviceId,
            bundleId,
            proposalLink,
            contractLink,
        } = req.request.body

        // First stage should be 'Inquiry' (s-1)
        const inquiryStage = await prisma.pipelineStage.findUnique({
            where: { name: 'Inquiry' }
        })

        if (!inquiryStage) {
            return { status: 500, body: { error: 'Inquiry stage not found in DB.' } }
        }

        if (primaryContactId) {
            const selectedContact = await prisma.contact.findFirst({
                where: { id: primaryContactId, clientId },
                select: { id: true },
            })

            if (!selectedContact) {
                return { status: 400, body: { error: 'Selected primary contact does not belong to this client.' } }
            }
        }

        const newDeal = await prisma.deal.create({
            data: {
                dealName,
                clientId,
                bdId: user.id, // assign strictly to current user
                monthlySubscription,
                revenue: monthlySubscription * duration,
                duration,
                stageId: inquiryStage.id,
                leadSource,
                serviceId,
                bundleId,
                proposalLink,
                contractLink,
                startDate: new Date(contractStartDate),
                dueDate: new Date(contractEndDate),
                lastStageUpdateAt: new Date(),
                ...(primaryContactId && {
                    dealContacts: {
                        create: {
                            contactId: primaryContactId,
                            isPrimary: true,
                        },
                    },
                }),
                auditLogs: {
                    create: {
                        stageId: inquiryStage.id,
                        changedById: user.id,
                        enteredAt: new Date(),
                        notes: 'Initial inquiry created'
                    }
                }
            },
            include: {
                client: true,
                stage: true,
                bd: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    }
                },
                service: true,
                bundle: true,
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
                    select: {
                        id: true,
                        enteredAt: true,
                        remarks: true,
                        actionPlan: true,
                        actionPlanDueDate: true,
                        notes: true,
                    },
                },
            }
        })

        logger.info('Created new deal', { dealId: newDeal.id, bdId: user.id })

        await enqueue({
            topic: 'deal.created',
            data: {
                dealId: newDeal.id,
                dealName: newDeal.dealName,
                bdId: newDeal.bdId,
                stageId: newDeal.stageId,
                revenue: newDeal.revenue,
                expectedCloseDate: newDeal.dueDate ?? newDeal.startDate,
            },
        })

        await createTeamNotification({
            dealId: newDeal.id,
            type: 'NEW_DEAL_ASSIGNED',
            triggeredBy: 'STAGE_CHANGE',
            content: `New deal "${newDeal.dealName}" was created and assigned to ${newDeal.bd.firstName} ${newDeal.bd.lastName}.`,
        }).catch((error) => logger.warn('Failed to create direct new-deal notification', { error }))

        return {
            status: 201,
            body: {
                ...newDeal,
                stage_name: newDeal.stage.name,
                days_in_stage: 0
            },
        }

    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            return {
                status: 400,
                body: { error: 'Related record not found — check bdMemberId, clientId, serviceIds, etc.' }
            }
        }
        logger.error('Failed to create deal', { error })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
