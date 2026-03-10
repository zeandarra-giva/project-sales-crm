import { type Handlers, type StepConfig } from 'motia'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { prisma } from '../../../lib/prisma.js'
import { signToken } from '../../../lib/auth.js'

export const config = {
  name: 'AuthLogin',
  description: 'Authenticate a BD member and return a JWT token',
  triggers: [
    {
      type: 'http' as const,
      path: '/api/auth/login',
      method: 'POST' as const,
      bodySchema: z.object({ email: z.string().email(), password: z.string().min(1) }),
    },
  ],
  enqueues: [],
  flows: ['auth'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { email, password } = req.body

  const user = await prisma.bD.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !user.isActive) return { status: 401, body: { error: 'Invalid credentials' } }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return { status: 401, body: { error: 'Invalid credentials' } }

  const token = signToken({ id: user.id, email: user.email, role: user.role })

  logger.info('User logged in', { userId: user.id })
  return {
    status: 200,
    body: {
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
    },
  }
}
