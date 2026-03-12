import { type Handlers, type StepConfig, logger } from 'motia'
import { z } from 'zod'
import { authenticate } from '../../../lib/auth'

export const config = {
    name: 'AuthMe',
    description: 'Get current authenticated user profile',
    triggers: [
        {
            type: 'http' as const,
            method: 'GET' as const,
            path: '/api/auth/me',
        },
    ],
    enqueues: [],
    flows: ['auth'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, ctx) => {
    try {
        // authenticate() reads the JWT from the Authorization header,
        // verifies it, and returns the user from the database
        const user = await authenticate(req.request)

        logger.info('Auth check successful', { userId: user.id })

        return {
            status: 200,
            body: { user },
        }
    } catch (error: any) {
        logger.warn('Auth check failed', { error: error.message })
        return {
            status: 401,
            body: { error: 'Not authenticated' },
        }
    }
}