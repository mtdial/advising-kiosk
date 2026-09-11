import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabasePublic } from '../supabase'
import { useAuth } from './AuthContext'

// Falls back to this if a school row can't be loaded (e.g. offline, or the
// migration hasn't run yet on this project). Mirrors the schools table's own
// column defaults — see supabase/migrations/20260911000000_multi_tenant_theming.sql
const BASE_THEME = {
  primary_color:   '#0E0E0D',
  accent_color:    '#B29F56',
  nav_fill_color:  '#003162',
  nav_shelf_color: '#6A0009',
  link_color:      '#6E6C68',
  hover_color:     '#F7F4EC',
}

const CSS_VAR_MAP = {
  primary_color:   '--primary',
  accent_color:    '--accent',
  nav_fill_color:  '--nav-fill',
  nav_shelf_color: '--nav-shelf',
  link_color:      '--link-color',
  hover_color:     '--hover-color',
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const { schoolId } = useAuth() ?? {}
  const [school, setSchool]   = useState(null)
  const [loading, setLoading] = useState(true)

  const loadSchool = async () => {
    setLoading(true)
    // Signed-in advisors resolve their own tenant. Public pages (kiosk,
    // login) have no user yet, so they fall back to the one school row
    // that exists for this deployment — today each customer runs their
    // own Supabase project/site, so there's exactly one row until this
    // app grows subdomain/slug-based tenant routing.
    const query = schoolId
      ? supabase.from('schools').select('*').eq('id', schoolId).maybeSingle()
      : supabasePublic.from('schools').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle()

    const { data } = await query
    setSchool(data ?? null)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    loadSchool().then(() => {
      if (cancelled) { /* no-op, state already ignored on unmount */ }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId])

  useEffect(() => {
    const root = document.documentElement
    for (const [column, cssVar] of Object.entries(CSS_VAR_MAP)) {
      root.style.setProperty(cssVar, school?.[column] || BASE_THEME[column])
    }
  }, [school])

  return (
    <ThemeContext.Provider value={{
      school,
      loading,
      logoUrl:    school?.logo_url ?? null,
      schoolName: school?.name ?? null,
      refresh:    loadSchool,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
