import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getMe } from '../../api/auth'

interface AuthGuardProps {
    children: React.ReactNode
    requiredRole?: 'BD_REP' | 'SALES_MANAGER'
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
    const navigate = useNavigate()
    const { token, logout } = useAuthStore()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkAuth = async () => {
            // No token at all — go to login
            if (!token) {
                navigate('/login')
                return
            }

            try {
                // Verify token is still valid by calling /me
                const data = await getMe()

                // We update the global auth state directly since setAuth doesn't exist
                useAuthStore.setState({ user: data.user, isAuthenticated: true })

                // Check role if required
                if (requiredRole && data.user.role !== requiredRole) {
                    // BD_REP trying to access manager page — redirect to their dashboard
                    navigate('/dashboard')
                    return
                }

                setLoading(false)
            } catch {
                // Token expired or invalid
                logout()
                navigate('/login')
            }
        }

        checkAuth()
    }, [token, navigate, requiredRole, logout])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading...</p>
            </div>
        )
    }

    return <>{children}</>
}