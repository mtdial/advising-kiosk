import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import NavBar from '../components/NavBar'

function formatWait(checkedInAt, now) {
  const total = Math.max(0, Math.floor((now - new Date(checkedInAt).getTime()) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

export default function SuiteAdminPage() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow]         = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Only queue entries for advisors flagged as working in the UAC Suite,
  // regardless of which college they belong to.
  const fetchQueue = useCallback(async () => {
    const { data, error } = await supabase
      .from('queue')
      .select('*, college:colleges(name), advisor:advisors!inner(name, is_uac_suite)')
      .eq('advisor.is_uac_suite', true)
      .in('status', ['waiting', 'in-progress'])
      .order('checked_in_at', { ascending: true })
    if (!error) setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchQueue()
    const poll = setInterval(fetchQueue, 5000)
    const channel = supabase
      .channel('suite-admin-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, fetchQueue)
      .subscribe()
    return () => { clearInterval(poll); supabase.removeChannel(channel) }
  }, [fetchQueue])

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#003366]">UAC Suite Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">{rows.length} active {rows.length === 1 ? 'entry' : 'entries'}</p>
          </div>
          <button onClick={fetchQueue} className="text-sm border border-[#003366] text-[#003366] px-3 py-1.5 rounded-lg hover:bg-[#003366] hover:text-white transition-colors">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading queue…</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-16 text-center text-gray-400">
            No students currently waiting on advisors in the UAC Suite.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  {['Student Name', 'Student Email', 'College', 'Advisor', 'Appt Type', 'Wait Time', 'Status'].map((h) => (
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        r.appointment_type === 'Drop-In' ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800'
                      }`}>
                        {r.appointment_type ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-700 whitespace-nowrap">
                      {formatWait(r.checked_in_at, now)}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'waiting' ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#FFB300] text-[#003366]">waiting</span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">in-progress</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
