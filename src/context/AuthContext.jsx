import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext(null)

async function fetchAdvisorProfile(email) {
  if (!email) return null
  const { data } = await supabase
    .from('advisors')
    .select('id, name, role, college_id, is_college_admin, is_suite_admin, ea_suite_admin')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  return data ?? null
}

export function AuthProvider({ children }) {
  const [user, setUser]                 = useState(null)
  const [role, setRole]                 = useState(null)
  const [advisorId, setAdvisorId]       = useState(null)
  const [advisorName, setAdvisorName]   = useState(null)
  const [collegeId, setCollegeId]       = useState(null)
  const [isCollegeAdmin, setIsCollegeAdmin]   = useState(false)
  const [isSuiteAdmin, setIsSuiteAdmin]       = useState(false)
  const [isEASuiteAdmin, setIsEASuiteAdmin]   = useState(false)
  const [loading, setLoading]           = useState(true)

  const applyProfile = (profile) => {
    setRole(profile?.role ?? null)
    setAdvisorId(profile?.id ?? null)
    setAdvisorName(profile?.name ?? null)
    setCollegeId(profile?.college_id ?? null)
    setIsCollegeAdmin(profile?.is_college_admin ?? false)
    setIsSuiteAdmin(profile?.is_suite_admin ?? false)
    setIsEASuiteAdmin(profile?.ea_suite_admin ?? false)
  }

  const clearProfile = () => {
    setRole(null)
    setAdvisorId(null)
    setAdvisorName(null)
    setCollegeId(null)
    setIsCollegeAdmin(false)
    setIsSuiteAdmin(false)
    setIsEASuiteAdmin(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user?.email) {
        applyProfile(await fetchAdvisorProfile(session.user.email))
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user?.email) {
        const email = session.user.email
        setTimeout(() => {
          fetchAdvisorProfile(email).then(applyProfile)
        }, 0)
      } else {
        clearProfile()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const profile = await fetchAdvisorProfile(email)
    return {
      ...data,
      advisorRole:    profile?.role ?? null,
      advisorName:    profile?.name ?? null,
      isCollegeAdmin: profile?.is_college_admin ?? false,
      isSuiteAdmin:   profile?.is_suite_admin ?? false,
      isEASuiteAdmin: profile?.ea_suite_admin ?? false,
    }
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{
      user, role, advisorId, advisorName, collegeId,
      isCollegeAdmin, isSuiteAdmin, isEASuiteAdmin,
      loading, signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
