import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole, requireFlag }) {
  const auth = useAuth()
  const { user, role, loading } = auth

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#73000a]">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/advisor" replace />
  }

  // Full admins can see any flag-gated view; otherwise the user needs the flag itself.
  if (requireFlag && !auth[requireFlag] && role !== 'admin') {
    return <Navigate to="/advisor" replace />
  }

  return children
}
