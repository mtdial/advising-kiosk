import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import NavBar from '../components/NavBar'

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatWait(checkedInAt, now) {
  const total = Math.max(0, Math.floor((now - new Date(checkedInAt).getTime()) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

function formatWaitFrozen(checkedInAt, seenAt) {
  if (!seenAt) return '—'
  const total = Math.max(0, Math.floor((new Date(seenAt).getTime() - new Date(checkedInAt).getTime()) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''))
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const vals = []
      let cur = '', inQ = false
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
        else { cur += ch }
      }
      vals.push(cur.trim())
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').replace(/^"|"$/g, '')]))
    })
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function ApptBadge({ type }) {
  if (type === 'Office Hours: Drop-In') {
    return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#CED318]/20 text-[#73000a]">{type}</span>
  }
  return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#466A9F]/15 text-[#466A9F]">{type ?? '—'}</span>
}

function StatusBadge({ status }) {
  if (status === 'waiting') {
    return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#CED318] text-[#73000a]">waiting</span>
  }
  if (status === 'in-progress') {
    return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#466A9F]/15 text-[#466A9F]">in-progress</span>
  }
  return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#CED318]/20 text-[#65780B]">seen</span>
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-[#73000a]' : 'bg-gray-300'
      }`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )
}

function ToggleRow({ label, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'queue',    label: 'Live Queue' },
  { id: 'add',      label: 'Add Advisor' },
  { id: 'bulk',     label: 'Bulk Upload' },
  { id: 'advisors', label: 'Manage Advisors' },
  { id: 'colleges', label: 'Manage Colleges' },
]

// ── TAB 1 — Live Queue ────────────────────────────────────────────────────────

function LiveQueueTab({ now }) {
  const [rows, setRows]         = useState([])
  const [seenRows, setSeenRows] = useState([])
  const [loading, setLoading]   = useState(true)

  const todayStart = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }

  const fetchQueue = useCallback(async () => {
    const [activeRes, seenRes] = await Promise.all([
      supabase
        .from('queue')
        .select('*, college:colleges(name), advisor:advisors(name)')
        .in('status', ['waiting', 'in-progress'])
        .order('checked_in_at', { ascending: true }),
      supabase
        .from('queue')
        .select('*, college:colleges(name), advisor:advisors(name)')
        .eq('status', 'seen')
        .gte('seen_at', todayStart().toISOString())
        .order('seen_at', { ascending: false }),
    ])
    if (!activeRes.error) setRows(activeRes.data ?? [])
    if (!seenRes.error)   setSeenRows(seenRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchQueue()
    const poll = setInterval(fetchQueue, 5000)
    const channel = supabase
      .channel('admin-queue-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe()
    return () => { clearInterval(poll); supabase.removeChannel(channel) }
  }, [fetchQueue])

  if (loading) return <div className="py-20 text-center text-gray-400">Loading queue…</div>

  return (
    <div>
      {/* Active queue */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-[#73000a]">Live Queue</h2>
          <p className="text-sm text-gray-500 mt-0.5">{rows.length} active {rows.length === 1 ? 'entry' : 'entries'}</p>
        </div>
        <button onClick={fetchQueue} className="text-sm border border-[#73000a] text-[#73000a] px-3 py-1.5 rounded-lg hover:bg-[#73000a] hover:text-white transition-colors">
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-16 text-center text-gray-400">
          No students currently waiting.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                {['Student Name', 'Student Email', 'College', 'Advisor', 'Appt Type', 'Wait Time', 'Status', 'Notes'].map((h) => (
                  <th key={h} className="px-4 py-3 text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{r.student_name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.student_email}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.college?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {r.advisor_id === null ? 'Next Available' : (r.advisor?.name ?? '—')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><ApptBadge type={r.appointment_type} /></td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700 whitespace-nowrap">
                    {formatWait(r.checked_in_at, now)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    {r.notes ? <span className="text-sm italic">{r.notes}</span> : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Seen Today */}
      {seenRows.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold text-gray-700 mb-3">Seen Today</h2>
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  {['Student Name', 'Student Email', 'College', 'Advisor', 'Appt Type', 'Wait Time', 'Notes'].map((h) => (
                    <th key={h} className="px-4 py-3 text-gray-600 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seenRows.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{r.student_name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.student_email}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.college?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {r.advisor_id === null ? 'Next Available' : (r.advisor?.name ?? '—')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><ApptBadge type={r.appointment_type} /></td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-500 whitespace-nowrap">
                      {formatWaitFrozen(r.checked_in_at, r.seen_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      {r.notes ? <span className="text-sm italic">{r.notes}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared: call create-advisor edge function ─────────────────────────────────

async function callCreateAdvisor({ name, email, college_id, role }) {
  const { data: { session } } = await supabase.auth.getSession()
  const { data, error } = await supabase.functions.invoke('create-advisor', {
    body: { name, email, college_id: college_id || null, role: role || 'advisor' },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

// ── TAB 2 — Add Advisor ───────────────────────────────────────────────────────

function AddAdvisorTab({ colleges }) {
  const blank = { name: '', email: '', college_id: '', role: 'advisor' }
  const [form, setForm]       = useState(blank)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(''); setSuccess('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return }
    setLoading(true)
    try {
      await callCreateAdvisor({
        name:       form.name.trim(),
        email:      form.email.trim().toLowerCase(),
        college_id: form.college_id || null,
        role:       form.role,
      })
      setSuccess(`Advisor added! They can now log in with the default password.`)
      setForm(blank)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#73000a] focus:border-transparent'

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold text-[#73000a] mb-5">Add Advisor</h2>
      <div className="bg-white rounded-xl shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
            <input type="text" value={form.name} onChange={set('name')} placeholder="Jane Smith" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="jsmith@sc.edu" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">College</label>
            <select value={form.college_id} onChange={set('college_id')} className={`${inputCls} bg-white`}>
              <option value="">— No college assigned —</option>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
            <select value={form.role} onChange={set('role')} className={`${inputCls} bg-white`}>
              <option value="advisor">Advisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error   && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-[#65780B] bg-[#CED318]/10 border border-[#CED318]/30 rounded-lg px-3 py-2">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#73000a] text-white font-semibold py-2.5 rounded-lg hover:bg-[#570008] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding…' : 'Add Advisor'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── TAB 3 — Bulk Upload ───────────────────────────────────────────────────────

function BulkUploadTab({ colleges }) {
  const [dragging, setDragging]     = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress]     = useState({ done: 0, total: 0 })
  const [result, setResult]         = useState(null)
  const inputRef                    = useRef(null)

  const processFile = async (file) => {
    if (!file || !file.name.endsWith('.csv')) { setResult({ error: 'Please upload a .csv file.' }); return }
    setProcessing(true); setProgress({ done: 0, total: 0 }); setResult(null)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length === 0) throw new Error('No data rows found in CSV.')
      const { data: existing } = await supabase.from('advisors').select('email')
      const existingEmails = new Set((existing ?? []).map((a) => a.email.toLowerCase()))
      const toProcess = []; const skipped = []
      for (const row of rows) {
        const name  = row.name?.trim()
        const email = row.email?.trim().toLowerCase()
        const collegeName = (row.college_name || row.college)?.trim()
        const role  = row.role?.trim() || 'advisor'
        if (!name || !email) { skipped.push({ row: email || name || '(empty)', reason: 'Missing name or email' }); continue }
        if (existingEmails.has(email)) { skipped.push({ row: email, reason: 'Email already exists' }); continue }
        let college_id = null
        if (collegeName) {
          const match = colleges.find((c) => c.name.toLowerCase() === collegeName.toLowerCase())
          if (!match) { skipped.push({ row: email, reason: `College not found: "${collegeName}"` }); continue }
          college_id = match.id
        }
        toProcess.push({ name, email, college_id, role })
        existingEmails.add(email)
      }
      const BATCH = 5; let added = 0
      setProgress({ done: 0, total: toProcess.length })
      for (let i = 0; i < toProcess.length; i += BATCH) {
        const batch = toProcess.slice(i, i + BATCH)
        const results = await Promise.allSettled(batch.map((a) => callCreateAdvisor(a)))
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') added++
          else skipped.push({ row: batch[idx].email, reason: r.reason?.message ?? 'Unknown error' })
        })
        setProgress({ done: Math.min(i + BATCH, toProcess.length), total: toProcess.length })
      }
      setResult({ added, skipped })
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setProcessing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-[#73000a] mb-5">Bulk Upload Advisors</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5">
        <p className="text-sm font-semibold text-gray-700 mb-2">Expected CSV format:</p>
        <pre className="text-xs text-gray-600 font-mono leading-relaxed">
{`name,email,college_name,role
Jane Smith,jsmith@sc.edu,College of Arts and Sciences,advisor
John Doe,jdoe@sc.edu,College of Engineering and Computing,admin`}
        </pre>
        <p className="text-xs text-gray-400 mt-2">
          <span className="font-medium">college_name</span> (or <span className="font-medium">college</span>) must exactly match a college name in Supabase.
        </p>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !processing && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? 'border-[#73000a] bg-red-50' : 'border-gray-300 hover:border-[#73000a] hover:bg-gray-50'
        } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(e) => processFile(e.target.files[0])} disabled={processing} className="hidden" />
        <div className="text-4xl mb-3">📂</div>
        <p className="font-semibold text-gray-700">
          {processing
            ? progress.total > 0 ? `Processing… ${progress.done} / ${progress.total}` : 'Processing…'
            : 'Drop a CSV file here or click to browse'}
        </p>
        <p className="text-sm text-gray-400 mt-1">.csv files only</p>
      </div>
      {result && (
        <div className="mt-5">
          {result.error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{result.error}</div>
          ) : (
            <div className="space-y-3">
              <div className="bg-[#CED318]/10 border border-[#CED318]/30 text-[#65780B] rounded-xl px-4 py-3 text-sm font-medium">
                Upload complete: <strong>{result.added}</strong> advisor{result.added !== 1 ? 's' : ''} added
                {result.skipped.length > 0 && <>, <strong>{result.skipped.length}</strong> skipped</>}
              </div>
              {result.skipped.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">Skipped Rows</div>
                  <ul className="divide-y divide-gray-100">
                    {result.skipped.map((s, i) => (
                      <li key={i} className="px-4 py-2.5 text-sm flex justify-between gap-4">
                        <span className="font-mono text-gray-700">{s.row}</span>
                        <span className="text-gray-500">{s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Edit Advisor Modal ────────────────────────────────────────────────────────

function EditAdvisorModal({ advisor, colleges, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:             advisor.name,
    email:            advisor.email,
    college_id:       advisor.college_id ?? '',
    role:             advisor.role,
    is_active:        advisor.is_active ?? true,
    is_college_admin: advisor.is_college_admin ?? false,
    is_uac_suite:     advisor.is_uac_suite ?? false,
    is_suite_admin:   advisor.is_suite_admin ?? false,
    ea_suite:         advisor.ea_suite ?? false,
    ea_suite_admin:   advisor.ea_suite_admin ?? false,
  })
  const [saving, setSaving]                   = useState(false)
  const [error, setError]                     = useState('')
  const [majorsList, setMajorsList]           = useState([])
  const [assignedMajorIds, setAssignedMajorIds] = useState(new Set())
  const [majorsLoading, setMajorsLoading]     = useState(false)

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError('') }
  const tog = (k) => () => { setForm((f) => ({ ...f, [k]: !f[k] })) }

  useEffect(() => {
    if (!form.college_id) { setMajorsList([]); setAssignedMajorIds(new Set()); return }
    setMajorsLoading(true)
    Promise.all([
      supabase.from('majors').select('id, name').eq('college_id', form.college_id).eq('is_active', true).order('name'),
      supabase.from('advisor_majors').select('major_id').eq('advisor_id', advisor.id),
    ]).then(([{ data: majors }, { data: assigned }]) => {
      setMajorsList(majors ?? [])
      setAssignedMajorIds(new Set((assigned ?? []).map((r) => r.major_id)))
      setMajorsLoading(false)
    })
  }, [form.college_id, advisor.id])

  const toggleMajor = (id) => {
    setAssignedMajorIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return }
    setSaving(true)
    const { error: dbErr } = await supabase.from('advisors').update({
      name:             form.name.trim(),
      email:            form.email.trim().toLowerCase(),
      college_id:       form.college_id || null,
      role:             form.role,
      is_active:        form.is_active,
      is_college_admin: form.is_college_admin,
      is_uac_suite:     form.is_uac_suite,
      is_suite_admin:   form.is_suite_admin,
      ea_suite:         form.ea_suite,
      ea_suite_admin:   form.ea_suite_admin,
    }).eq('id', advisor.id)
    if (dbErr) { setSaving(false); setError(dbErr.code === '23505' ? 'That email is already in use.' : dbErr.message); return }
    await supabase.from('advisor_majors').delete().eq('advisor_id', advisor.id)
    if (assignedMajorIds.size > 0) {
      await supabase.from('advisor_majors').insert([...assignedMajorIds].map((major_id) => ({ advisor_id: advisor.id, major_id })))
    }
    setSaving(false)
    onSaved({ ...advisor, ...form, college_id: form.college_id || null, college: colleges.find((c) => c.id === form.college_id) ?? null })
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#73000a] focus:border-transparent'
  const TOGGLES = [
    { key: 'is_active',        label: 'Active' },
    { key: 'is_college_admin', label: 'College Admin' },
    { key: 'is_uac_suite',     label: 'UAC Suite' },
    { key: 'is_suite_admin',   label: 'Suite Admin' },
    { key: 'ea_suite',         label: 'EA Suite' },
    { key: 'ea_suite_admin',   label: 'EA Suite Admin' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[#73000a]">Edit Advisor</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label><input type="text" value={form.name} onChange={set('name')} className={inputCls} /></div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Email *</label><input type="email" value={form.email} onChange={set('email')} className={inputCls} /></div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">College</label>
            <select value={form.college_id} onChange={set('college_id')} className={`${inputCls} bg-white`}>
              <option value="">— No college assigned —</option>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
            <select value={form.role} onChange={set('role')} className={`${inputCls} bg-white`}>
              <option value="advisor">Advisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Access & Status</p>
            <div className="border border-gray-200 rounded-lg px-3">
              {TOGGLES.map(({ key, label }) => (
                <ToggleRow key={key} label={label} checked={!!form[key]} onChange={tog(key)} disabled={saving} />
              ))}
            </div>
          </div>
          {form.college_id && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-0.5">Assigned Majors</p>
              <p className="text-xs text-gray-400 mb-2">Leave all unchecked to advise all majors.</p>
              {majorsLoading ? (
                <p className="text-sm text-gray-400 py-2">Loading majors…</p>
              ) : majorsList.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No majors configured for this college.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {majorsList.map((m) => (
                    <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={assignedMajorIds.has(m.id)}
                        onChange={() => toggleMajor(m.id)}
                        disabled={saving}
                        className="h-4 w-4 rounded border-gray-300 text-[#73000a] focus:ring-[#73000a]"
                      />
                      <span className="text-sm text-gray-700">{m.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#73000a] text-white font-semibold py-2.5 rounded-lg hover:bg-[#570008] transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TAB 4 — Manage Advisors ───────────────────────────────────────────────────

function ManageAdvisorsTab({ colleges }) {
  const [advisors, setAdvisors] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)
  const [sortKey, setSortKey]   = useState('name')
  const [sortDir, setSortDir]   = useState('asc')

  const fetchAdvisors = useCallback(async () => {
    const { data } = await supabase.from('advisors').select('*, college:colleges(name)')
    setAdvisors(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAdvisors() }, [fetchAdvisors])

  const handleSaved = (updated) => {
    setAdvisors((prev) => prev.map((a) => a.id === updated.id ? { ...a, ...updated } : a))
    setEditing(null)
  }

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...advisors].sort((a, b) => {
    let av = '', bv = ''
    if (sortKey === 'name')    { av = a.name ?? ''; bv = b.name ?? '' }
    if (sortKey === 'college') { av = a.college?.name ?? ''; bv = b.college?.name ?? '' }
    if (sortKey === 'role')    { av = a.role ?? ''; bv = b.role ?? '' }
    const cmp = av.localeCompare(bv)
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (loading) return <div className="py-20 text-center text-gray-400">Loading advisors…</div>

  const SortArrow = ({ col }) => (
    <span className={`ml-1 text-xs ${sortKey === col ? 'text-[#73000a]' : 'text-gray-300'}`}>
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  const sortTh = (label, key) => (
    <th key={key} onClick={() => toggleSort(key)} className="px-5 py-3 text-gray-600 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-[#73000a] hover:bg-gray-100 transition-colors">
      {label}<SortArrow col={key} />
    </th>
  )

  return (
    <div>
      {editing && <EditAdvisorModal advisor={editing} colleges={colleges} onClose={() => setEditing(null)} onSaved={handleSaved} />}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-[#73000a]">Manage Advisors</h2>
          <p className="text-sm text-gray-500 mt-0.5">{advisors.length} total advisors</p>
        </div>
        <button onClick={fetchAdvisors} className="text-sm border border-[#73000a] text-[#73000a] px-3 py-1.5 rounded-lg hover:bg-[#73000a] hover:text-white transition-colors">Refresh</button>
      </div>
      {advisors.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">No advisors found.</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                {sortTh('Name', 'name')}
                <th className="px-5 py-3 text-gray-600 font-semibold whitespace-nowrap">Email</th>
                {sortTh('College', 'college')}
                {sortTh('Role', 'role')}
                <th className="px-5 py-3 text-gray-600 font-semibold whitespace-nowrap">Status</th>
                <th className="px-5 py-3 text-gray-600 font-semibold whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a, i) => (
                <tr key={a.id} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">{a.name}</td>
                  <td className="px-5 py-3 text-gray-500">{a.email}</td>
                  <td className="px-5 py-3 text-gray-600">{a.college?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 capitalize">{a.role}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${a.is_active ? 'bg-[#CED318]/20 text-[#65780B]' : 'bg-gray-100 text-gray-400'}`}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => setEditing(a)} className="text-xs font-semibold text-[#73000a] border border-[#73000a] px-3 py-1 rounded-lg hover:bg-[#73000a] hover:text-white transition-colors">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── TAB 5 — Manage Colleges ───────────────────────────────────────────────────

function ManageCollegesTab() {
  const [colleges, setColleges] = useState([])
  const [loading, setLoading]   = useState(true)
  const [toggling, setToggling] = useState(null)

  const fetchColleges = useCallback(async () => {
    const { data } = await supabase.from('colleges').select('*').order('name', { ascending: true })
    setColleges(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchColleges() }, [fetchColleges])

  const toggleActive = async (id, current) => {
    setToggling(id + '_active')
    await supabase.from('colleges').update({ is_active: !current }).eq('id', id)
    setColleges((prev) => prev.map((c) => c.id === id ? { ...c, is_active: !current } : c))
    setToggling(null)
  }

  const toggleMajorDropdown = async (id, current) => {
    setToggling(id + '_major')
    await supabase.from('colleges').update({ show_major_dropdown: !current }).eq('id', id)
    setColleges((prev) => prev.map((c) => c.id === id ? { ...c, show_major_dropdown: !current } : c))
    setToggling(null)
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading colleges…</div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-[#73000a]">Manage Colleges</h2>
          <p className="text-sm text-gray-500 mt-0.5">Active colleges appear in the kiosk dropdown. Add or remove colleges directly in Supabase.</p>
        </div>
        <button onClick={fetchColleges} className="text-sm border border-[#73000a] text-[#73000a] px-3 py-1.5 rounded-lg hover:bg-[#73000a] hover:text-white transition-colors">Refresh</button>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-5 py-3 text-gray-600 font-semibold">College Name</th>
              <th className="px-5 py-3 text-gray-600 font-semibold">Active</th>
              <th className="px-5 py-3 text-gray-600 font-semibold">Require Major</th>
            </tr>
          </thead>
          <tbody>
            {colleges.map((c, i) => (
              <tr key={c.id} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50' : ''}`}>
                <td className="px-5 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Toggle checked={c.is_active} onChange={() => toggleActive(c.id, c.is_active)} disabled={toggling === c.id + '_active'} />
                    <span className={`text-xs font-semibold ${c.is_active ? 'text-[#65780B]' : 'text-gray-400'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Toggle checked={!!c.show_major_dropdown} onChange={() => toggleMajorDropdown(c.id, c.show_major_dropdown)} disabled={toggling === c.id + '_major'} />
                    <span className={`text-xs font-semibold ${c.show_major_dropdown ? 'text-[#466A9F]' : 'text-gray-400'}`}>{c.show_major_dropdown ? 'On' : 'Off'}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('queue')
  const [colleges, setColleges]   = useState([])
  const [now, setNow]             = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    supabase
      .from('colleges')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data }) => setColleges(data ?? []))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div className="flex gap-1 bg-white rounded-xl shadow p-1 flex-wrap">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === id ? 'bg-[#73000a] text-white' : 'text-gray-600 hover:text-[#73000a]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <a href="/sign" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#73000a] bg-white shadow px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            🖨 Print Check-In Sign
          </a>
        </div>
        {activeTab === 'queue'    && <LiveQueueTab now={now} />}
        {activeTab === 'add'      && <AddAdvisorTab colleges={colleges} />}
        {activeTab === 'bulk'     && <BulkUploadTab colleges={colleges} />}
        {activeTab === 'advisors' && <ManageAdvisorsTab colleges={colleges} />}
        {activeTab === 'colleges' && <ManageCollegesTab />}
      </div>
    </div>
  )
}
