import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { prisma } from '../../../lib/db'
import { authenticate } from '../../../lib/auth'
import { createTeamNotification } from '../../../lib/notifications'

export const config = {
    name: 'TerminateDealContract',
    description: 'Terminate an active closed-won contract early and log the activity',
    triggers: [
        {
            type: 'http' as const,
            method: 'POST' as const,
            path: '/api/deals/:id/terminate',
            bodySchema: z.object({
                terminatedAt: z.string().datetime(),
                reason: z.string().min(1),
                notes: z.string().optional(),
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
        const { terminatedAt, reason, notes } = req.request.body

        const deal = await prisma.deal.findUnique({
            where: { id },
            include: { stage: true },
        })

        if (!deal) {
            return { status: 404, body: { error: 'Deal not found' } }
        }

        if (user.role !== 'SALES_MANAGER' && deal.bdId !== user.id) {
            return { status: 403, body: { error: 'You can only manage your own deals' } }
        }

        if (deal.stage.name !== 'Closed Won') {
            return { status: 400, body: { error: 'Only closed-won deals can be terminated as active contracts.' } }
        }

        if (deal.contractStatus === 'TERMINATED') {
            return { status: 400, body: { error: 'This contract is already terminated.' } }
        }

        const effectiveTerminationDate = new Date(terminatedAt)

        if (deal.startDate && effectiveTerminationDate < deal.startDate) {
            return { status: 400, body: { error: 'Termination date cannot be before the contract start date.' } }
        }

        const updatedDeal = await prisma.$transaction(async (tx) => {
            await tx.dealActivity.create({
                data: {
                    dealId: id,
                    type: 'CONTRACT_TERMINATED',
                    title: 'Contract terminated early',
                    description: [
                        `Reason: ${reason}`,
                        notes?.trim() ? `Notes: ${notes.trim()}` : null,
                    ].filter(Boolean).join('\n'),
                    effectiveDate: effectiveTerminationDate,
                    createdById: user.id,
                },
            })

            return tx.deal.update({
                where: { id },
                data: {
                    contractStatus: 'TERMINATED',
                    terminatedAt: effectiveTerminationDate,
                    terminationReason: reason.trim(),
                    terminationNotes: notes?.trim() || null,
                    terminatedById: user.id,
                },
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
        })

        logger.info('Terminated contract', { dealId: id, by: user.id })

        await createTeamNotification({
            dealId: updatedDeal.id,
            type: 'FOLLOW_UP_DUE',
            triggeredBy: 'NO_FOLLOW_UP_IN_14_DAYS',
            content: `Contract for "${updatedDeal.dealName}" was terminated effective ${effectiveTerminationDate.toLocaleDateString('en-PH')}. Review collections and account follow-up.`,
        }).catch((error) => logger.warn('Failed to create termination notification', { error, dealId: id }))

        return { status: 200, body: updatedDeal }
    } catch (error: any) {
        if (error.name === 'AuthError') {
            return { status: 401, body: { error: error.message } }
        }

        logger.error('Failed to terminate contract', {
            error: error.message,
            dealId: req.request.pathParams.id,
        })
        return { status: 500, body: { error: 'Internal server error' } }
    }
}
