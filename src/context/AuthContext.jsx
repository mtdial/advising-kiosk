import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext(null)

async function fetchAdvisorProfile(email) {
  if (!email) return null
  const { data } = await supabase
    .from('advisors')
    .select('id, name, role')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  return data ?? null
}

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [role, setRole]               = useState(null)
  const [advisorId, setAdvisorId]     = useState(null)
  const [advisorName, setAdvisorName] = useState(null)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user?.email) {
        const profile = await fetchAdvisorProfile(session.user.email)
        setRole(profile?.role ?? null)
        setAdvisorId(profile?.id ?? null)
        setAdvisorName(profile?.name ?? null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user?.email) {
        const profile = await fetchAdvisorProfile(session.user.email)
        setRole(profile?.role ?? null)
        setAdvisorId(profile?.id ?? null)
        setAdvisorName(profile?.name ?? null)
      } else {
        setRole(null)
        setAdvisorId(null)
        setAdvisorName(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const profile = await fetchAdvisorProfile(email)
    return { ...data, advisorRole: profile?.role ?? null, advisorName: profile?.name ?? null }
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, role, advisorId, advisorName, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
