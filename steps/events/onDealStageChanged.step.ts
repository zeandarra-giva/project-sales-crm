import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { createTeamNotification } from '../../lib/notifications'

// Schema for the data emitted by updateStage.step.ts
const stageChangedSchema = z.object({
    dealId: z.string(),
    dealName: z.string(),
    previousStageId: z.string(),
    previousStageName: z.string(),
    newStageId: z.string(),
    newStageName: z.string(),
    bdId: z.string(),
    changedById: z.string(),
    isClosed: z.boolean(),
})

export const config = {
    name: 'OnDealStageChanged',
    description: 'Listens for deal.stage.changed events and creates a notification for the BD rep',
    triggers: [
        {
            type: 'queue' as const,
            topic: 'deal.stage.changed',
            input: stageChangedSchema,
        },
    ],
    flows: ['notification-system'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (input) => {
    try {
        const data = stageChangedSchema.parse(input)

        // Build a human-readable notification message
        const closedPrefix = data.isClosed
            ? (data.newStageName === 'Closed Won' ? '🎉 Deal won! ' : '❌ Deal lost. ')
            : ''
        const content = `${closedPrefix}"${data.dealName}" moved from ${data.previousStageName} to ${data.newStageName}.`

        await createTeamNotification({
            content,
            type: 'STAGE_CHANGE',
            triggeredBy: 'STAGE_CHANGE',
            dealId: data.dealId,
        })

        logger.info('Stage change notification created', {
            dealId: data.dealId,
            bdId: data.bdId,
            from: data.previousStageName,
            to: data.newStageName,
        })

    } catch (error: any) {
        logger.error('Failed to create stage change notification', {
            error: error.message,
            input,
        })
    }
}
