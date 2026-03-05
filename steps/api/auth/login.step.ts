import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { prisma } from '../../../lib/db'
import { signToken } from '../../../lib/auth'

export const config = {
    name: 'AuthLogin',
    description: 'Authenticate BD member and return JWT',
    triggers: [
        {
            type: 'http' as const,
            method: 'POST' as const,
            path: '/api/auth/login',
            bodySchema: z.object({
                email: z.string().email(),
                password: z.string().min(1),
            }),
        },
    ],
    enqueues: [],
    flows: ['auth'],
} as const satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
    const { email, password } = req.body

    logger.info('Login attempt', { email })

    // 1. Find BD member by email
    const bd = await prisma.bD.findUnique({
        where: { email },
    })

    if (!bd) {
        logger.warn('Login failed - user not found', { email })
        return {
            status: 401,
            body: { error: 'Invalid email or password' },
        }
    }

    // 2. Check if account is active
    if (!bd.isActive) {
        logger.warn('Login failed - account deactivated', { email })
        return {
            status: 401,
            body: { error: 'Account is deactivated' },
        }
    }

    // 3. Compare password with bcrypt
    const passwordValid = await bcrypt.compare(password, bd.password)

    if (!passwordValid) {
        logger.warn('Login failed - wrong password', { email })
        return {
            status: 401,
            body: { error: 'Invalid email or password' },
        }
    }

    // 4. Create JWT token
    const token = signToken({
        bdId: bd.id,
        email: bd.email,
        role: bd.role,
    })

    logger.info('Login successful', { email, role: bd.role })

    // 5. Return token and user info (without password)
    return {
        status: 200,
        body: {
            token,
            user: {
                id: bd.id,
                firstName: bd.firstName,
                lastName: bd.lastName,
                email: bd.email,
                role: bd.role,
            },
        },
    }
}