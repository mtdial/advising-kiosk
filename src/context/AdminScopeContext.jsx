import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from './AuthContext'

// Only meaningful for a platform_admin: which school's data the admin panel
// (and Theme Settings) is currently scoped to. Everyone else is always
// scoped to their own school_id -- see effectiveSchoolId below.
const AdminScopeContext = createContext(null)

export function AdminScopeProvider({ children }) {
  const { role, schoolId } = useAuth() ?? {}
  const isPlatformAdmin = role === 'platform_admin'

  const [schools, setSchools] = useState([])
  // '' = not chosen yet, 'all' = browsing every school, or a school id.
  const [selectedSchoolId, setSelectedSchoolId] = useState('')

  useEffect(() => {
    if (!isPlatformAdmin) { setSchools([]); return }
    supabase
      .from('schools')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data }) => setSchools(data ?? []))
  }, [isPlatformAdmin])

  // Default a platform_admin onto their own school as soon as it's known,
  // rather than leaving the switcher unset.
  useEffect(() => {
    if (isPlatformAdmin && !selectedSchoolId && schoolId) {
      setSelectedSchoolId(schoolId)
    }
  }, [isPlatformAdmin, schoolId, selectedSchoolId])

  const setSchool = useCallback((id) => setSelectedSchoolId(id), [])

  // What every scoped query should actually filter by:
  //   - not a platform_admin -> always their own school_id
  //   - platform_admin, "All Schools" chosen -> null (no filter)
  //   - platform_admin, one school chosen -> that school's id
  const effectiveSchoolId = isPlatformAdmin
    ? (selectedSchoolId === 'all' ? null : (selectedSchoolId || schoolId || null))
    : (schoolId ?? null)

  const isAllSchools = isPlatformAdmin && selectedSchoolId === 'all'

  return (
    <AdminScopeContext.Provider value={{
      isPlatformAdmin,
      schools,
      selectedSchoolId,
      setSelectedSchoolId: setSchool,
      effectiveSchoolId,
      isAllSchools,
    }}>
      {children}
    </AdminScopeContext.Provider>
  )
}

export const useAdminScope = () => useContext(AdminScopeContext)
