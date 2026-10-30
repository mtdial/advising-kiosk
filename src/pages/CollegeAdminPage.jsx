import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { useLiveQueue, QUEUE_COLUMNS } from '../hooks/useLiveQueue'
import { buildXlsx, downloadBlob } from '../lib/xlsx'
import NavBar from '../components/NavBar'

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

function ApptBadge({ type }) {
  if (type === 'Office Hours: Drop-In') {
    return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#CED318]/20 text-[var(--primary)]">{type}</span>
  }
  return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#466A9F]/15 text-[#466A9F]">{type ?? '—'}</span>
}

const STATUSES = [
  { value: 'waiting',     label: 'Waiting' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'seen',        label: 'Seen' },
]

const selectCls = 'text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]'

function StatusCell({ row, readOnly, onStatus }) {
  if (readOnly) {
    if (row.status === 'waiting') {
      return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--accent)] text-[var(--primary)]">waiting</span>
    }
    if (row.status === 'seen') {
      return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#CED318]/20 text-[#65780B]">seen</span>
    }
    return <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#466A9F]/15 text-[#466A9F]">in-progress</span>
  }
  return (
    <select value={row.status} onChange={(e) => onStatus(row, e.target.value)} className={selectCls} aria-label={`Status for ${row.student_name}`}>
      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  )
}

function SeenByCell({ row, advisors, readOnly, onSeenBy }) {
  if (readOnly) {
    return <span className="text-gray-600">{row.seen_by?.name ?? '—'}</span>
  }
  return (
    <select value={row.seen_by_advisor_id ?? ''} onChange={(e) => onSeenBy(row, e.target.value || null)} className={selectCls} aria-label={`Seen by for ${row.student_name}`}>
      <option value="">—</option>
      {advisors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  )
}

const Notes = ({ notes }) => (
  <td className="px-4 py-3 text-gray-600 max-w-xs">
    {notes ? <span className="text-sm italic">{notes}</span> : <span className="text-gray-300">—</span>}
  </td>
)

function QueueTable({ rows, now, advisors, readOnly, onStatus, onSeenBy, showSeenBy }) {
  const headers = ['Student Name', 'Student Email', 'Advisor', 'Appt Type', 'Wait Time', 'Status', ...(showSeenBy ? ['Seen By'] : []), 'Notes']
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-left">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-gray-600 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50' : ''}`}>
              <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{r.student_name}</td>
              <td className="px-4 py-3 text-gray-500">{r.student_email}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                {r.advisor_id === null ? 'Next Available' : (r.advisor?.name ?? '—')}
              </td>
              <td className="px-4 py-3 whitespace-nowrap"><ApptBadge type={r.appointment_type} /></td>
              <td className="px-4 py-3 font-mono text-sm text-gray-700 whitespace-nowrap">
                {formatWait(r.checked_in_at, now)}
              </td>
              <td className="px-4 py-3"><StatusCell row={r} readOnly={readOnly} onStatus={onStatus} /></td>
              {showSeenBy && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <SeenByCell row={r} advisors={advisors} readOnly={readOnly} onSeenBy={onSeenBy} />
                </td>
              )}
              <Notes notes={r.notes} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SeenTable({ rows, advisors, readOnly, onStatus, onSeenBy }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-left">
            {['Student Name', 'Student Email', 'Advisor', 'Appt Type', 'Wait Time', 'Status', 'Seen By', 'Notes'].map((h) => (
              <th key={h} className="px-4 py-3 text-gray-600 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50' : ''}`}>
              <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{r.student_name}</td>
              <td className="px-4 py-3 text-gray-500">{r.student_email}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                {r.advisor_id === null ? 'Next Available' : (r.advisor?.name ?? '—')}
              </td>
              <td className="px-4 py-3 whitespace-nowrap"><ApptBadge type={r.appointment_type} /></td>
              <td className="px-4 py-3 font-mono text-sm text-gray-500 whitespace-nowrap">
                {formatWaitFrozen(r.checked_in_at, r.seen_at)}
              </td>
              <td className="px-4 py-3"><StatusCell row={r} readOnly={readOnly} onStatus={onStatus} /></td>
              <td className="px-4 py-3 whitespace-nowrap">
                <SeenByCell row={r} advisors={advisors} readOnly={readOnly} onSeenBy={onSeenBy} />
              </td>
              <Notes notes={r.notes} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const EXPORT_HEADERS = ['Student Name', 'Student Email', 'Advisor', 'Appt Type', 'Checked In', 'Wait Time', 'Status', 'Seen By', 'Notes']

function exportRow(r, now) {
  return [
    r.student_name,
    r.student_email,
    r.advisor_id === null ? 'Next Available' : (r.advisor?.name ?? ''),
    r.appointment_type ?? '',
    r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : '',
    r.status === 'seen' ? formatWaitFrozen(r.checked_in_at, r.seen_at) : formatWait(r.checked_in_at, now),
    r.status,
    r.seen_by?.name ?? '',
    r.notes ?? '',
  ]
}

export default function CollegeAdminPage() {
  const { collegeId, role, isCollegeAdmin } = useAuth()
  const readOnly = role === 'student_assistant' && !isCollegeAdmin
  const [now, setNow] = useState(Date.now())
  const [advisors, setAdvisors] = useState([])
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Advisors who can be credited with seeing a student (student assistants excluded).
  useEffect(() => {
    if (!collegeId || readOnly) return
    supabase
      .from('advisors')
      .select('id, name')
      .eq('college_id', collegeId)
      .eq('is_active', true)
      .neq('role', 'student_assistant')
      .order('name', { ascending: true })
      .then(({ data }) => setAdvisors(data ?? []))
  }, [collegeId, readOnly])

  const fetchData = useCallback(async () => {
    if (!collegeId) return { active: [], seen: [] }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const [activeRes, seenRes] = await Promise.all([
      supabase
        .from('queue')
        .select(`${QUEUE_COLUMNS}, advisor:advisors!advisor_id(name), seen_by:advisors!seen_by_advisor_id(name)`)
        .eq('college_id', collegeId)
        .in('status', ['waiting', 'in-progress'])
        .order('checked_in_at', { ascending: true }),
      supabase
        .from('queue')
        .select(`${QUEUE_COLUMNS}, advisor:advisors!advisor_id(name), seen_by:advisors!seen_by_advisor_id(name)`)
        .eq('college_id', collegeId)
        .eq('status', 'seen')
        .gte('seen_at', todayStart.toISOString())
        .order('seen_at', { ascending: false }),
    ])
    if (activeRes.error || seenRes.error) return null
    return { active: activeRes.data ?? [], seen: seenRes.data ?? [] }
  }, [collegeId])

  const resolve = useCallback((row, lookups) => {
    if (row.college_id !== collegeId) return false
    const advisor = lookups.advisors?.get(row.advisor_id)
    const seenBy  = lookups.advisors?.get(row.seen_by_advisor_id)
    if ((row.advisor_id && !advisor) || (row.seen_by_advisor_id && !seenBy)) return null
    return {
      ...row,
      advisor: advisor ? { name: advisor.name } : null,
      seen_by: seenBy ? { name: seenBy.name } : null,
    }
  }, [collegeId])

  const { active: rows, seen: seenRows, loading, applyRow, refetch: fetchQueue } = useLiveQueue({
    enabled: !!collegeId,
    channelName: `college-admin-queue-${collegeId}`,
    filter: `college_id=eq.${collegeId}`,
    fetchData,
    lookupKinds: ['advisors'],
    resolve,
  })

  const waitingRows    = rows.filter((r) => r.status === 'waiting')
  const inProgressRows = rows.filter((r) => r.status === 'in-progress')

  const save = async (row, patch) => {
    setActionError('')
    const { error } = await supabase.from('queue').update(patch).eq('id', row.id)
    if (error) { setActionError(`Could not update ${row.student_name}: ${error.message}`); return }
    applyRow({ ...row, ...patch })
  }

  const handleStatus = (row, status) => {
    if (status === row.status) return
    const stamp = new Date().toISOString()
    if (status === 'waiting') {
      return save(row, { status, in_progress_at: null, seen_at: null, seen_by_advisor_id: null })
    }
    if (status === 'in-progress') {
      return save(row, { status, in_progress_at: row.in_progress_at ?? stamp, seen_at: null })
    }
    // seen: credit the advisor who actually saw the student, defaulting to the one they chose
    return save(row, {
      status,
      seen_at: stamp,
      in_progress_at: row.in_progress_at ?? stamp,
      seen_by_advisor_id: row.seen_by_advisor_id ?? row.advisor_id ?? null,
    })
  }

  const handleSeenBy = (row, advisorId) => {
    const patch = { seen_by_advisor_id: advisorId }
    // An unassigned "Next Available" entry becomes that advisor's, as when an advisor picks it up.
    if (advisorId && row.advisor_id === null) patch.advisor_id = advisorId
    return save(row, patch)
  }

  const handleExport = () => {
    const stamp = Date.now()
    const sheetRows = (list) => [EXPORT_HEADERS, ...list.map((r) => exportRow(r, stamp))]
    const blob = buildXlsx([
      { name: 'Live Queue', rows: sheetRows(waitingRows) },
      { name: 'Currently Being Seen', rows: sheetRows(inProgressRows) },
      { name: 'Seen Today', rows: sheetRows(seenRows) },
    ])
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    downloadBlob(blob, `college-queue-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`)
  }

  const tableProps = { advisors, readOnly, onStatus: handleStatus, onSeenBy: handleSeenBy }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--primary)]">College Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {waitingRows.length} waiting · {inProgressRows.length} in progress
              {readOnly && ' · read-only view'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <button onClick={handleExport} disabled={loading || !collegeId} className="text-sm font-semibold text-[var(--primary)] bg-white shadow px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50">
                ⬇ Export to Excel
              </button>
            )}
            <a href="/advising-checkin-sign.pdf" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--primary)] bg-white shadow px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              🖨 Print Check-In Sign
            </a>
            <button onClick={fetchQueue} className="text-sm border border-[var(--link-color)] text-[var(--primary)] px-3 py-1.5 rounded-lg hover:bg-[var(--link-color)] hover:text-white transition-colors">
              Refresh
            </button>
          </div>
        </div>

        {actionError && (
          <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</p>
        )}

        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading queue…</div>
        ) : !collegeId ? (
          <div className="bg-white rounded-xl shadow p-16 text-center text-gray-400">
            Your account isn't assigned to a college yet. Contact an admin.
          </div>
        ) : (
          <>
            {/* Live Queue — waiting */}
            <section className="mb-8">
              <h2 className="text-base font-bold text-gray-700 mb-3">
                Live Queue
                {waitingRows.length > 0 && <span className="ml-2 text-sm font-normal text-gray-500">({waitingRows.length})</span>}
              </h2>
              {waitingRows.length === 0 ? (
                <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">No students currently waiting.</div>
              ) : (
                <QueueTable rows={waitingRows} now={now} {...tableProps} />
              )}
            </section>

            {/* Currently Being Seen — in-progress */}
            {inProgressRows.length > 0 && (
              <section className="mb-8">
                <h2 className="text-base font-bold text-gray-700 mb-3">
                  Currently Being Seen
                  <span className="ml-2 text-sm font-normal text-gray-500">({inProgressRows.length})</span>
                </h2>
                <QueueTable rows={inProgressRows} now={now} showSeenBy {...tableProps} />
              </section>
            )}

            {/* Seen Today */}
            {seenRows.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-700 mb-3">
                  Seen Today
                  <span className="ml-2 text-sm font-normal text-gray-500">({seenRows.length})</span>
                </h2>
                <SeenTable rows={seenRows} {...tableProps} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
