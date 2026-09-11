import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../supabase'
import NavBar from '../components/NavBar'

// Column key -> label + CSS var, in the order they render. Keep in sync with
// the schools table (supabase/migrations/20260911000000_multi_tenant_theming.sql)
// and ThemeContext's CSS_VAR_MAP.
const COLOR_FIELDS = [
  { key: 'primary_color',   label: 'Primary',    hint: 'Headings, primary text accents' },
  { key: 'accent_color',    label: 'Accent',     hint: 'Badges, highlights' },
  { key: 'nav_fill_color',  label: 'Nav Fill',   hint: 'Nav bar & brand backgrounds' },
  { key: 'nav_shelf_color', label: 'Nav Shelf',  hint: 'Small accent stripe in the nav bar' },
  { key: 'link_color',      label: 'Link',       hint: 'Outlined buttons & links' },
  { key: 'hover_color',     label: 'Hover',      hint: 'Hover state for filled buttons' },
]

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function ColorField({ label, hint, value, onChange }) {
  const valid = HEX_RE.test(value || '')
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 rounded-lg border border-gray-300 cursor-pointer"
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className={`w-32 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent ${
            valid ? 'border-gray-300' : 'border-red-400 bg-red-50'
          }`}
        />
        <span className="text-xs text-gray-400">{hint}</span>
      </div>
    </div>
  )
}

export default function ThemeSettingsPage() {
  const { schoolId } = useAuth()
  const { refresh } = useTheme() ?? {}

  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  useEffect(() => {
    if (!schoolId) return
    supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single()
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        setForm(data)
        setLoading(false)
      })
  }, [schoolId])

  const set = (key) => (value) => { setForm((f) => ({ ...f, [key]: value })); setError(''); setSuccess('') }

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setError(''); setSuccess('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    for (const { key, label } of COLOR_FIELDS) {
      if (!HEX_RE.test(form[key] || '')) {
        setError(`${label} must be a valid hex color (e.g. #73000a).`)
        return
      }
    }

    setSaving(true)
    try {
      let logo_url = form.logo_url ?? null

      // school_id is never taken from a form field or URL — it comes from the
      // signed-in advisor's own row (useAuth), and the schools/storage RLS
      // policies re-check that server-side regardless.
      if (logoFile) {
        const path = `${schoolId}/logo.png`
        const { error: uploadErr } = await supabase.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
        if (uploadErr) throw uploadErr
        const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
        // Cache-bust: the object path never changes, so browsers/CDN would
        // otherwise keep serving the old image after an overwrite.
        logo_url = `${pub.publicUrl}?v=${Date.now()}`
      }

      const { error: dbErr } = await supabase
        .from('schools')
        .update({
          theme_name:      form.theme_name,
          primary_color:   form.primary_color,
          accent_color:    form.accent_color,
          nav_fill_color:  form.nav_fill_color,
          nav_shelf_color: form.nav_shelf_color,
          link_color:      form.link_color,
          hover_color:     form.hover_color,
          logo_url,
        })
        .eq('id', schoolId)
      if (dbErr) throw dbErr

      setForm((f) => ({ ...f, logo_url }))
      setLogoFile(null)
      setSuccess('Theme saved!')
      refresh?.()
    } catch (err) {
      setError(err.message || 'Something went wrong saving your theme.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent'

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-[var(--primary)] mb-1">Theme Settings</h1>
        <p className="text-sm text-gray-500 mb-6">Customize your school's branding across the kiosk and advisor pages.</p>

        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading…</div>
        ) : !form ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
            Couldn't find your school. Contact an administrator.
          </div>
        ) : (
          <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Theme Name</label>
              <input
                type="text"
                value={form.theme_name || ''}
                onChange={(e) => set('theme_name')(e.target.value)}
                placeholder="e.g. USC Garnet"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Logo</label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {logoPreview || form.logo_url ? (
                    <img src={logoPreview || form.logo_url} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-gray-300">No logo</span>
                  )}
                </div>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="text-sm" />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Uploaded to logos/{schoolId}/logo.png. PNG recommended, transparent background.</p>
            </div>

            <div className="space-y-4 border-t border-gray-100 pt-5">
              {COLOR_FIELDS.map(({ key, label, hint }) => (
                <ColorField key={key} label={label} hint={hint} value={form[key]} onChange={set(key)} />
              ))}
            </div>

            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-sm text-[#65780B] bg-[#CED318]/10 border border-[#CED318]/30 rounded-lg px-3 py-2">{success}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[var(--nav-fill)] text-white font-semibold py-2.5 rounded-lg hover:bg-[var(--hover-color)] transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Theme'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
