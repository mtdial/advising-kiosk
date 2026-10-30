import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useLiveQueue, QUEUE_COLUMNS } from '../hooks/useLiveQueue'
import NavBar from '../components/NavBar'

function formatWait(checkedInAt, now) {
  const total = Math.max(0, Math.floor((now - new Date(checkedInAt).getTime()) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

function formatWaitFrozen(checkedInAt, seenAt) {
  const total = Math.max(0, Math.floor((new Date(seenAt).getTime() - new Date(checkedInAt).getTime()) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

function ApptBadge({ type }) {
  const isDropIn = type === 'Office Hours: Drop-In'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
      isDropIn ? 'bg-[#CED318]/20 text-[var(--primary)]' : 'bg-[#466A9F]/15 text-[#466A9F]'
    }`}>
      {type ?? '—'}
    </span>
  )
}

function QueueTable({ rows, now, showAdvisor = true }) {
  const cols = ['Student Name', 'Student Email', 'College', ...(showAdvisor ? ['Advisor'] : []), 'Appt Type', 'Wait Time', 'Notes']
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-left">
            {cols.map((h) => (
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
              {showAdvisor && <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.advisor?.name ?? '—'}</td>}
              <td className="px-4 py-3 whitespace-nowrap"><ApptBadge type={r.appointment_type} /></td>
              <td className="px-4 py-3 font-mono text-sm text-gray-700 whitespace-nowrap">{formatWait(r.checked_in_at, now)}</td>
              <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.notes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SeenTable({ rows }) {
  if (rows.length === 0) return null
  const cols = ['Student Name', 'Student Email', 'College', 'Advisor', 'Appt Type', 'Wait Time', 'Notes', 'Seen At']
  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-gray-700 mb-3">Seen Today</h2>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {cols.map((h) => (
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
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.advisor?.name ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap"><ApptBadge type={r.appointment_type} /></td>
                <td className="px-4 py-3 font-mono text-sm text-gray-700 whitespace-nowrap">
                  {formatWaitFrozen(r.checked_in_at, r.seen_at)}
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.notes ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(r.seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SuiteAdminPage() {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = useCallback(async () => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [activeRes, seenRes] = await Promise.all([
      supabase
        .from('queue')
        .select(`${QUEUE_COLUMNS}, college:colleges(name), advisor:advisors!advisor_id!inner(name, is_uac_suite)`)
        .eq('advisor.is_uac_suite', true)
        .in('status', ['waiting', 'in-progress'])
        .order('checked_in_at', { ascending: true }),
      supabase
        .from('queue')
        .select(`${QUEUE_COLUMNS}, college:colleges(name), advisor:advisors!advisor_id!inner(name, is_uac_suite)`)
        .eq('advisor.is_uac_suite', true)
        .eq('status', 'seen')
        .gte('seen_at', todayStart.toISOString())
        .order('seen_at', { ascending: false }),
    ])
    if (activeRes.error || seenRes.error) return null
    return { active: activeRes.data ?? [], seen: seenRes.data ?? [] }
  }, [])

  // Only rows assigned to a suite advisor belong here (mirrors the advisors!inner filter).
  const resolve = useCallback((row, lookups) => {
    if (!row.advisor_id) return false
    const advisor = lookups.advisors?.get(row.advisor_id)
    if (!advisor) return null
    if (!advisor.is_uac_suite) return false
    const college = lookups.colleges?.get(row.college_id)
    if (row.college_id && !college) return null
    return {
      ...row,
      college: college ? { name: college.name } : null,
      advisor: { name: advisor.name, is_uac_suite: advisor.is_uac_suite },
    }
  }, [])

  const { active, seen: seenRows, loading, refetch: fetchQueue } = useLiveQueue({
    channelName: 'suite-admin-queue',
    fetchData,
    lookupKinds: ['colleges', 'advisors'],
    resolve,
  })
  const waitingRows = active.filter((r) => r.status === 'waiting')
  const inProgRows  = active.filter((r) => r.status === 'in-progress')

  const totalActive = waitingRows.length + inProgRows.length

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-[var(--primary)]">UAC Suite Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalActive} active {totalActive === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/advising-checkin-sign.pdf" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--primary)] bg-white shadow px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              🖨 Print Check-In Sign
            </a>
            <button
              onClick={fetchQueue}
              className="text-sm border border-[var(--link-color)] text-[var(--primary)] px-3 py-1.5 rounded-lg hover:bg-[var(--link-color)] hover:text-white transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading queue…</div>
        ) : totalActive === 0 && seenRows.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-16 text-center text-gray-400">
            No students currently waiting on advisors in the UAC Suite.
          </div>
        ) : (
          <>
            {/* Live Queue */}
            {waitingRows.length > 0 && (
              <div className="mb-6">
                <h2 className="text-base font-semibold text-gray-700 mb-3">
                  Live Queue <span className="text-gray-400 font-normal">({waitingRows.length} waiting)</span>
                </h2>
                <QueueTable rows={waitingRows} now={now} />
              </div>
            )}

            {/* Currently Being Seen */}
            {inProgRows.length > 0 && (
              <div className="mb-6">
                <h2 className="text-base font-semibold text-[#466A9F] mb-3">
                  Currently Being Seen <span className="text-gray-400 font-normal">({inProgRows.length})</span>
                </h2>
                <QueueTable rows={inProgRows} now={now} />
              </div>
            )}

            {/* Seen Today */}
            <SeenTable rows={seenRows} />
          </>
        )}
      </div>
    </div>
  )
}
