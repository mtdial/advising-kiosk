import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
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
      isDropIn ? 'bg-[#FFB300]/20 text-[#73000a]' : 'bg-[#dce6f0] text-[#466A9F]'
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
  const [waitingRows, setWaitingRows]   = useState([])
  const [inProgRows, setInProgRows]     = useState([])
  const [seenRows, setSeenRows]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [now, setNow]                   = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchQueue = useCallback(async () => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [activeRes, seenRes] = await Promise.all([
      supabase
        .from('queue')
        .select('*, college:colleges(name), advisor:advisors!inner(name, is_uac_suite)')
        .eq('advisor.is_uac_suite', true)
        .in('status', ['waiting', 'in-progress'])
        .order('checked_in_at', { ascending: true }),
      supabase
        .from('queue')
        .select('*, college:colleges(name), advisor:advisors!inner(name, is_uac_suite)')
        .eq('advisor.is_uac_suite', true)
        .eq('status', 'seen')
        .gte('seen_at', todayStart.toISOString())
        .order('seen_at', { ascending: false }),
    ])

    if (!activeRes.error) {
      const active = activeRes.data ?? []
      setWaitingRows(active.filter(r => r.status === 'waiting'))
      setInProgRows(active.filter(r => r.status === 'in-progress'))
    }
    if (!seenRes.error) setSeenRows(seenRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchQueue()
    const poll = setInterval(fetchQueue, 10000)
    const channel = supabase
      .channel('suite-admin-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe()
    return () => { clearInterval(poll); supabase.removeChannel(channel) }
  }, [fetchQueue])

  const totalActive = waitingRows.length + inProgRows.length

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#73000a]">UAC Suite Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalActive} active {totalActive === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <button
            onClick={fetchQueue}
            className="text-sm border border-[#73000a] text-[#73000a] px-3 py-1.5 rounded-lg hover:bg-[#73000a] hover:text-white transition-colors"
          >
            Refresh
          </button>
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
