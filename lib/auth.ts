import jwt from 'jsonwebtoken'
import { prisma } from './prisma.js'

const JWT_SECRET  = process.env.JWT_SECRET || 'sales-crm-secret-change-in-production'
const JWT_EXPIRES = '7d'

export interface JWTPayload {
  id:    string
  email: string
  role:  string  // 'BD_REP' | 'SALES_MANAGER'
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload
}

export async function authenticate(req: { headers: Record<string, string | string[] | undefined> }) {
  const authHeader = req.headers['authorization']
  if (!authHeader || typeof authHeader !== 'string') {
    return { error: 'Missing authorization header', status: 401, user: null }
  }
  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return { error: 'Invalid authorization format. Use: Bearer <token>', status: 401, user: null }
  }
  try {
    const payload = verifyToken(token)
    const user = await prisma.bD.findUnique({
      where:  { id: payload.id },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true },
    })
    if (!user || !user.isActive) {
      return { error: 'User not found or deactivated', status: 401, user: null }
    }
    return { error: null, status: 200, user }
  } catch {
    return { error: 'Invalid or expired token', status: 401, user: null }
  }
}

/** True only for SALES_MANAGER role */
export function requireManager(role: string): boolean {
  return role === 'SALES_MANAGER'
}
