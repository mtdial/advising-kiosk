import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import NavBar from '../components/NavBar'

// ── Audio chime ───────────────────────────────────────────────────────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ctx.resume()
    const master = ctx.createGain()
    master.connect(ctx.destination)

    function tone(freq, start, duration) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(master)
      gain.gain.setValueAtTime(0.28, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.start(start)
      osc.stop(start + duration)
    }

    tone(880,  ctx.currentTime,        0.3)
    tone(1108, ctx.currentTime + 0.3,  0.4)
    setTimeout(() => ctx.close(), 1200)
  } catch {
    // audio not available — silently ignore
  }
}

// ── Wait timer ────────────────────────────────────────────────────────────────
function formatWait(checkedInAt, now) {
  const total = Math.max(0, Math.floor((now - new Date(checkedInAt).getTime()) / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

// ── Toast list ────────────────────────────────────────────────────────────────
function ToastList({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-[#FFB300] text-[#003366] text-sm px-4 py-3 rounded-xl shadow-xl flex items-start gap-2 max-w-xs animate-fade-in"
        >
          <span className="text-[#FFB300] mt-0.5">🔔</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
        <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-xl font-semibold text-gray-700">No students in your queue.</p>
      <p className="text-gray-400 mt-1">You're all caught up!</p>
    </div>
  )
}

// ── Queue card ────────────────────────────────────────────────────────────────
function QueueCard({ entry, now, onInProgress, onSeen }) {
  const isInProgress = entry.status === 'in-progress'
  const collegeName  = entry.college?.name ?? '—'

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-l-4 px-6 py-5 transition-all ${
      isInProgress ? 'border-[#FFB300] shadow-md' : 'border-gray-200'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        {/* Left: student info */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Name + appointment type badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-gray-900">{entry.student_name}</span>
            {entry.appointment_type === 'Drop-In' ? (
              <span className="text-xs font-bold bg-[#FFB300] text-[#003366] px-2.5 py-0.5 rounded-full">
                Drop-In
              </span>
            ) : (
              <span className="text-xs font-bold bg-[#003366] text-white px-2.5 py-0.5 rounded-full">
                Scheduled
              </span>
            )}
            {isInProgress && (
              <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                In Progress
              </span>
            )}
          </div>

          {/* Email */}
          <div className="text-sm text-gray-500">{entry.student_email}</div>

          {/* College */}
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">College:</span> {collegeName}
          </div>

          {/* Wait timer */}
          <div className={`text-sm font-mono font-semibold mt-1 ${
            Math.floor((now - new Date(entry.checked_in_at).getTime()) / 60000) >= 15
              ? 'text-red-500'
              : 'text-[#003366]'
          }`}>
            Waiting: {formatWait(entry.checked_in_at, now)}
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex flex-col gap-2 flex-shrink-0 sm:items-end">
          {entry.status === 'waiting' && (
            <button
              onClick={() => onInProgress(entry.id)}
              className="bg-[#FFB300] text-[#003366] font-bold px-5 py-2.5 rounded-xl hover:bg-[#e6a200] transition-colors text-sm shadow-sm w-full sm:w-auto"
            >
              Waiting
            </button>
          )}
          {entry.status === 'in-progress' && (
            <button
              onClick={() => onSeen(entry.id)}
              className="bg-green-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-green-700 transition-colors text-sm shadow-sm w-full sm:w-auto"
            >
              Mark as Seen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdvisorPage() {
  const { advisorId } = useAuth()
  const [queue, setQueue]     = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow]         = useState(Date.now())
  const [toasts, setToasts]   = useState([])
  const hasLoaded             = useRef(false)

  // ── Tick every second for live wait timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Toast helpers
  const addToast = useCallback((message) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  // ── Fetch queue (waiting + in-progress only, joined to colleges)
  const fetchQueue = useCallback(async () => {
    if (!advisorId) return
    const { data, error } = await supabase
      .from('queue')
      .select('*, college:colleges(name)')
      .eq('advisor_id', advisorId)
      .in('status', ['waiting', 'in-progress'])
      .order('checked_in_at', { ascending: true })
    if (!error) setQueue(data ?? [])
    setLoading(false)
    hasLoaded.current = true
  }, [advisorId])

  // ── Initial load + realtime subscription + polling fallback
  useEffect(() => {
    if (!advisorId) return
    fetchQueue()

    const poll = setInterval(fetchQueue, 2000)

    const channel = supabase
      .channel(`advisor-queue-${advisorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue', filter: `advisor_id=eq.${advisorId}` },
        (payload) => {
          // Play chime + toast only for brand-new check-ins while page is live
          if (
            payload.eventType === 'INSERT' &&
            payload.new.status === 'waiting' &&
            hasLoaded.current
          ) {
            playChime()
            addToast(
              `New check-in: ${payload.new.student_name} (${payload.new.appointment_type ?? 'Drop-In'})`
            )
          }
          fetchQueue()
        }
      )
      .subscribe()

    return () => {
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [advisorId, fetchQueue, addToast])

  // ── Status update helpers
  const handleInProgress = async (id) => {
    await supabase.from('queue').update({ status: 'in-progress' }).eq('id', id)
    // optimistic update
    setQueue((prev) => prev.map((r) => r.id === id ? { ...r, status: 'in-progress' } : r))
  }

  const handleSeen = async (id) => {
    await supabase
      .from('queue')
      .update({ status: 'seen', seen_at: new Date().toISOString() })
      .eq('id', id)
    // remove immediately from view
    setQueue((prev) => prev.filter((r) => r.id !== id))
  }

  // ── Sort: waiting first, then in-progress; each group oldest-first
  const sorted = [...queue].sort((a, b) => {
    const order = { waiting: 0, 'in-progress': 1 }
    const diff  = (order[a.status] ?? 2) - (order[b.status] ?? 2)
    if (diff !== 0) return diff
    return new Date(a.checked_in_at) - new Date(b.checked_in_at)
  })

  const waitingCount    = queue.filter((r) => r.status === 'waiting').length
  const inProgressCount = queue.filter((r) => r.status === 'in-progress').length

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <ToastList toasts={toasts} />

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Heading + counters */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#003366]">Your Queue</h1>
            {!loading && queue.length > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                {waitingCount} waiting · {inProgressCount} in progress
              </p>
            )}
          </div>
        </div>

        {/* Queue list */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <svg className="animate-spin w-6 h-6 mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            Loading queue…
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {sorted.map((entry) => (
              <QueueCard
                key={entry.id}
                entry={entry}
                now={now}
                onInProgress={handleInProgress}
                onSeen={handleSeen}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
