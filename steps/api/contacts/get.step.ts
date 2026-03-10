import { type Handlers, type StepConfig } from 'motia'
import { authenticate } from '../../../lib/auth.js'
import { prisma } from '../../../lib/prisma.js'

export const config = {
  name: 'GetContact',
  description: 'Get a single contact by ID',
  triggers: [{ type: 'http' as const, path: '/api/contacts/:id', method: 'GET' as const }],
  enqueues: [],
  flows: ['contacts'],
} satisfies StepConfig

export const handler: Handlers<typeof config> = async (req, { logger }) => {
  const { error, status } = await authenticate(req)
  if (error) return { status, body: { error } }

  const { id } = req.pathParams as { id: string }
  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) return { status: 404, body: { error: 'Contact not found' } }
  return { status: 200, body: { contact } }
}