import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
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
    return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#FFB300]/20 text-[#73000a]">{type}</span>
  }
  return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#dce6f0] text-[#466A9F]">{type ?? '—'}</span>
}

function QueueTable({ rows, now, showAdvisor = true }) {
  const headers = ['Student Name', 'Student Email', ...(showAdvisor ? ['Advisor'] : []), 'Appt Type', 'Wait Time', 'Status', 'Notes']
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
              {showAdvisor && (
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {r.advisor_id === null ? 'Next Available' : (r.advisor?.name ?? '—')}
                </td>
              )}
              <td className="px-4 py-3 whitespace-nowrap"><ApptBadge type={r.appointment_type} /></td>
              <td className="px-4 py-3 font-mono text-sm text-gray-700 whitespace-nowrap">
                {formatWait(r.checked_in_at, now)}
              </td>
              <td className="px-4 py-3">
                {r.status === 'waiting' ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#FFB300] text-[#73000a]">waiting</span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#dce6f0] text-[#466A9F]">in-progress</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 max-w-xs">
                {r.notes ? <span className="text-sm italic">{r.notes}</span> : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SeenTable({ rows }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-left">
            {['Student Name', 'Student Email', 'Advisor', 'Appt Type', 'Wait Time', 'Notes'].map((h) => (
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
              <td className="px-4 py-3 text-gray-600 max-w-xs">
                {r.notes ? <span className="text-sm italic">{r.notes}</span> : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CollegeAdminPage() {
  const { collegeId } = useAuth()
  const [rows, setRows]         = useState([])
  const [seenRows, setSeenRows] = useState([])
  const [loading, setLoading]   = useState(true)
  const [now, setNow]           = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchQueue = useCallback(async () => {
    if (!collegeId) { setLoading(false); return }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const [activeRes, seenRes] = await Promise.all([
      supabase
        .from('queue')
        .select('*, advisor:advisors(name)')
        .eq('college_id', collegeId)
        .in('status', ['waiting', 'in-progress'])
        .order('checked_in_at', { ascending: true }),
      supabase
        .from('queue')
        .select('*, advisor:advisors(name)')
        .eq('college_id', collegeId)
        .eq('status', 'seen')
        .gte('seen_at', todayStart.toISOString())
        .order('seen_at', { ascending: false }),
    ])
    if (!activeRes.error) setRows(activeRes.data ?? [])
    if (!seenRes.error)   setSeenRows(seenRes.data ?? [])
    setLoading(false)
  }, [collegeId])

  useEffect(() => {
    if (!collegeId) return
    fetchQueue()
    const poll = setInterval(fetchQueue, 5000)
    const channel = supabase
      .channel(`college-admin-queue-${collegeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `college_id=eq.${collegeId}` }, fetchQueue)
      .subscribe()
    return () => { clearInterval(poll); supabase.removeChannel(channel) }
  }, [collegeId, fetchQueue])

  const waitingRows    = rows.filter((r) => r.status === 'waiting')
  const inProgressRows = rows.filter((r) => r.status === 'in-progress')

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#73000a]">College Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">{waitingRows.length} waiting · {inProgressRows.length} in progress</p>
          </div>
          <button onClick={fetchQueue} className="text-sm border border-[#73000a] text-[#73000a] px-3 py-1.5 rounded-lg hover:bg-[#73000a] hover:text-white transition-colors">
            Refresh
          </button>
        </div>

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
                <QueueTable rows={waitingRows} now={now} />
              )}
            </section>

            {/* Currently Being Seen — in-progress */}
            {inProgressRows.length > 0 && (
              <section className="mb-8">
                <h2 className="text-base font-bold text-gray-700 mb-3">
                  Currently Being Seen
                  <span className="ml-2 text-sm font-normal text-gray-500">({inProgressRows.length})</span>
                </h2>
                <QueueTable rows={inProgressRows} now={now} />
              </section>
            )}

            {/* Seen Today */}
            {seenRows.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-gray-700 mb-3">
                  Seen Today
                  <span className="ml-2 text-sm font-normal text-gray-500">({seenRows.length})</span>
                </h2>
                <SeenTable rows={seenRows} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
