import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function landingRoute({ role, isCollegeAdmin, isSuiteAdmin }) {
  if (role === 'platform_admin' || role === 'system_admin') return '/admin'
  if (isCollegeAdmin) return '/college-admin'
  if (isSuiteAdmin) return '/suite-admin'
  return '/advisor'
}

export default function LoginPage() {
  const { signIn, user, role, isCollegeAdmin, isSuiteAdmin, loading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Already authenticated — send to the right dashboard
  if (!loading && user) {
    navigate(landingRoute({ role, isCollegeAdmin, isSuiteAdmin }), { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) return
    setSubmitting(true)
    try {
      const result = await signIn(email.trim(), password)
      navigate(landingRoute({
        role: result.advisorRole,
        isCollegeAdmin: result.isCollegeAdmin,
        isSuiteAdmin: result.isSuiteAdmin,
      }), { replace: true })
    } catch {
      setError('Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--nav-fill)] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Card header */}
        <div className="bg-[var(--nav-fill)] px-8 py-7 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-px bg-white" />
            <span className="text-white text-xs font-bold uppercase tracking-widest">
              University of South Carolina
            </span>
            <div className="w-8 h-px bg-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Advisor Login</h1>
          <p className="text-white/60 mt-1 text-sm">UAC Advising Kiosk — Staff Portal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder="you@sc.edu"
              autoComplete="username"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <span aria-hidden>⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password}
            className="w-full bg-[var(--nav-fill)] text-white font-semibold py-3 rounded-lg hover:bg-[var(--hover-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Signing In…
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            Authorized staff only.
          </p>
        </form>
      </div>
    </div>
  )
}
