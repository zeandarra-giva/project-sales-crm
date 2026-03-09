import jwt from 'jsonwebtoken'
import { prisma } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-32-char-random-string'
const JWT_EXPIRE_MINUTES = parseInt(process.env.JWT_EXPIRE_MINUTES || '1440', 10) // 24 hours in minutes
const JWT_EXPIRE_SECONDS = JWT_EXPIRE_MINUTES * 60

// What we store inside the JWT token
interface TokenPayload {
    bdId: string
    email: string
    role: string
}

// Sign a new JWT token
export function signToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRE_SECONDS, // number (seconds) — always valid, avoids StringValue brand issue
    })
}

// Verify a JWT token and return the payload
export function verifyToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
}

// Extract token from "Bearer <token>" header, verify it,
// and return the BD member from the database.
// Call this at the top of every protected Step.
export async function authenticate(req: any) {
    const authHeader = req.headers?.authorization || req.headers?.Authorization

    if (!authHeader) {
        throw new Error('No authorization header')
    }

    // Header format: "Bearer eyJhbGciOi..."
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
        throw new Error('No token provided')
    }

    // Verify the token — throws if expired or invalid
    const payload = verifyToken(token)

    // Fetch the BD member from database to get fresh data
    const bd = await prisma.bD.findUnique({
        where: { id: payload.bdId },
    })

    if (!bd) {
        throw new Error('User not found')
    }

    if (!bd.isActive) {
        throw new Error('Account is deactivated')
    }

    // Return the user without the password
    const { password, ...user } = bd
    return user
}