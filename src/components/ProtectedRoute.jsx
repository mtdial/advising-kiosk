import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ADMIN_ROLES = ['platform_admin', 'system_admin']

export default function ProtectedRoute({ children, requiredRole, requireFlag }) {
  const auth = useAuth()
  const { user, role, loading } = auth

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--nav-fill)]">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowed.includes(role)) {
      return <Navigate to="/advisor" replace />
    }
  }

  // Either admin tier can see any flag-gated view. A system_admin's own
  // queries are still scoped to their own school_id — this route guard just
  // decides who gets past the door, not what they see once inside.
  if (requireFlag && !auth[requireFlag] && !ADMIN_ROLES.includes(role)) {
    return <Navigate to="/advisor" replace />
  }

  return children
}
