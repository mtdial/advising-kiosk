import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

// ── Change Password Modal ─────────────────────────────────────────────────────

function ChangePasswordModal({ onClose }) {
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const { user } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (next !== confirm) { setError('Passwords do not match.'); return }
    if (next.length < 8)  { setError('New password must be at least 8 characters.'); return }

    setSaving(true)
    try {
      // Verify current password by re-authenticating
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    user.email,
        password: current,
      })
      if (signInErr) { setError('Current password is incorrect.'); return }

      // Update to new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: next })
      if (updateErr) { setError(updateErr.message); return }

      setSuccess('Password updated successfully!')
      setCurrent(''); setNext(''); setConfirm('')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[#003366]">Change Password</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {success}
            </p>
            <button
              onClick={onClose}
              className="w-full bg-[#003366] text-white font-semibold py-2.5 rounded-lg hover:bg-[#002244] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={current}
                onChange={(e) => { setCurrent(e.target.value); setError('') }}
                className={inputCls}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={next}
                onChange={(e) => { setNext(e.target.value); setError('') }}
                className={inputCls}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError('') }}
                className={inputCls}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#003366] text-white font-semibold py-2.5 rounded-lg hover:bg-[#002244] transition-colors disabled:opacity-60"
              >
                {saving ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── NavBar ────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { to: '/advisor',       label: 'My Queue',     show: () => true },
  { to: '/college-admin', label: 'College Queue', show: (a) => a.isCollegeAdmin || a.role === 'admin' },
  { to: '/suite-admin',   label: 'Suite Queue',   show: (a) => a.isSuiteAdmin || a.role === 'admin' },
  { to: '/admin',         label: 'Admin',          show: (a) => a.role === 'admin' },
]

export default function NavBar() {
  const auth = useAuth()
  const { advisorName, role, signOut } = auth
  const navigate = useNavigate()
  const location = useLocation()
  const [showChangePassword, setShowChangePassword] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const links = NAV_LINKS.filter((l) => l.show(auth))

  return (
    <>
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      <nav className="bg-[#003366] text-white px-6 py-4 flex items-center justify-between shadow-lg flex-wrap gap-3">
        {/* Left: app name + nav links */}
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-7 bg-[#FFB300] rounded-full" />
            <span className="font-bold text-lg tracking-tight">UAC Advising Kiosk</span>
          </div>
          {links.length > 1 && (
            <div className="flex items-center gap-1">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    location.pathname === l.to
                      ? 'bg-white/15 font-semibold'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right: user name + actions */}
        <div className="flex items-center gap-3">
          {advisorName && (
            <div className="flex items-center gap-2">
              {role === 'admin' && (
                <span className="text-xs bg-[#FFB300] text-[#003366] font-bold px-2 py-0.5 rounded">
                  ADMIN
                </span>
              )}
              <span className="text-sm text-blue-100 hidden sm:block">{advisorName}</span>
            </div>
          )}
          <button
            onClick={() => setShowChangePassword(true)}
            className="text-sm text-blue-200 hover:text-white transition-colors hidden sm:block"
          >
            Change Password
          </button>
          <button
            onClick={handleSignOut}
            className="text-sm bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </nav>
    </>
  )
}
