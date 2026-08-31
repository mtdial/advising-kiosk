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
    master.gain.value = 0.8
    master.connect(ctx.destination)
    function tone(freq, start, duration) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(master)
      gain.gain.setValueAtTime(0.6, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.start(start)
      osc.stop(start + duration)
    }
    const t = ctx.currentTime
    tone(523, t,        0.25)
    tone(659, t + 0.22, 0.25)
    tone(784, t + 0.44, 0.45)
    setTimeout(() => ctx.close(), 1600)
  } catch { /* audio not available */ }
}

// ── Browser push notification ─────────────────────────────────────────────────
function sendPushNotification(name, type) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification('New Student Check-In 🔔', {
    body: `${name} (${type}) is waiting to see you.`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'advisor-checkin',
    renotify: true,
  })
}

// ── Tab title flash ───────────────────────────────────────────────────────────
const BASE_TITLE = 'Your Queue'

function useTabFlash() {
  const flashRef = useRef(null)
  const startFlash = useCallback(() => {
    if (flashRef.current) return
    let toggle = true
    flashRef.current = setInterval(() => {
      document.title = toggle ? '🔔 New Check-In!' : BASE_TITLE
      toggle = !toggle
    }, 800)
  }, [])
  const stopFlash = useCallback(() => {
    if (flashRef.current) { clearInterval(flashRef.current); flashRef.current = null }
    document.title = BASE_TITLE
  }, [])
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) stopFlash() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', stopFlash)
    document.title = BASE_TITLE
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', stopFlash)
      document.title = BASE_TITLE
    }
  }, [stopFlash])
  return { startFlash, stopFlash }
}

// ── Wait timers ───────────────────────────────────────────────────────────────
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

// ── Toast list ────────────────────────────────────────────────────────────────
function ToastList({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="bg-[#FFB300] text-[#73000a] text-sm px-4 py-3 rounded-xl shadow-xl flex items-start gap-2 max-w-xs animate-fade-in">
          <span className="mt-0.5">🔔</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
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
  const isInProgress    = entry.status === 'in-progress'
  const collegeName     = entry.college?.name ?? '—'
  const isNextAvailable = entry.advisor_id === null

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-l-4 px-6 py-5 transition-all ${
      isInProgress ? 'border-[#FFB300] shadow-md' : 'border-gray-200'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

        {/* Left: student info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-gray-900">{entry.student_name}</span>
            {entry.appointment_type === 'Office Hours: Drop-In' ? (
              <span className="text-xs font-bold bg-[#FFB300] text-[#73000a] px-2.5 py-0.5 rounded-full">
                Office Hours: Drop-In
              </span>
            ) : (
              <span className="text-xs font-bold bg-[#73000a] text-white px-2.5 py-0.5 rounded-full">
                Scheduled
              </span>
            )}
            {isNextAvailable && (
              <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">
                Next Available
              </span>
            )}
            {isInProgress && (
              <span className="text-xs font-semibold bg-[#dce6f0] text-[#466A9F] px-2.5 py-0.5 rounded-full">
                In Progress
              </span>
            )}
          </div>

          <div className="text-sm text-gray-500">{entry.student_email}</div>

          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">College:</span> {collegeName}
          </div>

          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Here to see:</span>{' '}
            {isNextAvailable ? 'Next Available' : 'You'}
          </div>

          {entry.notes && (
            <div className="text-sm text-gray-600 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="font-medium text-gray-700">Notes: </span>
              {entry.notes}
            </div>
          )}

          <div className={`text-sm font-mono font-semibold mt-1 ${
            Math.floor((now - new Date(entry.checked_in_at).getTime()) / 60000) >= 15
              ? 'text-red-500'
              : 'text-[#73000a]'
          }`}>
            Waiting: {formatWait(entry.checked_in_at, now)}
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex flex-col gap-2 flex-shrink-0 sm:items-end">
          {entry.status === 'waiting' && (
            <button
              onClick={() => onInProgress(entry.id)}
              className="bg-[#FFB300] text-[#73000a] font-bold px-5 py-2.5 rounded-xl hover:bg-[#e6a200] transition-colors text-sm shadow-sm w-full sm:w-auto"
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

// ── Seen Today table ──────────────────────────────────────────────────────────
function SeenTodaySection({ advisorId, collegeId }) {
  const [seenRows, setSeenRows] = useState([])
  const [loading, setLoading]   = useState(true)

  const fetchSeen = useCallback(async () => {
    if (!advisorId) return
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    let query = supabase
      .from('queue')
      .select('*, college:colleges(name)')
      .eq('status', 'seen')
      .gte('seen_at', todayStart.toISOString())
      .order('seen_at', { ascending: false })

    query = collegeId
      ? query.or(`advisor_id.eq.${advisorId},advisor_id.is.null`).eq('college_id', collegeId)
      : query.eq('advisor_id', advisorId)

    const { data, error } = await query
    if (!error) setSeenRows(data ?? [])
    setLoading(false)
  }, [advisorId, collegeId])

  useEffect(() => {
    fetchSeen()
    const poll = setInterval(fetchSeen, 10000)
    const channel = supabase
      .channel(`advisor-seen-${advisorId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queue' }, fetchSeen)
      .subscribe()
    return () => { clearInterval(poll); supabase.removeChannel(channel) }
  }, [fetchSeen, advisorId])

  if (loading || seenRows.length === 0) return null

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-gray-700 mb-3">Seen Today</h2>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {['Student Name', 'Student Email', 'College', 'Appt Type', 'Wait Time', 'Notes'].map((h) => (
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
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    r.appointment_type === 'Office Hours: Drop-In'
                      ? 'bg-[#FFB300]/20 text-[#73000a]'
                      : 'bg-[#dce6f0] text-[#466A9F]'
                  }`}>
                    {r.appointment_type ?? '—'}
                  </span>
                </td>
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
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdvisorPage() {
  const { advisorId, collegeId } = useAuth()
  const [queue, setQueue]     = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow]         = useState(Date.now())
  const [toasts, setToasts]   = useState([])
  const hasLoaded             = useRef(false)

  // Office hours availability
  const [officeHoursAvailable, setOfficeHoursAvailable] = useState(false)
  const [officeHoursLoading, setOfficeHoursLoading]     = useState(true)

  const { startFlash } = useTabFlash()

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Fetch current office hours status
  useEffect(() => {
    if (!advisorId) return
    supabase
      .from('advisors')
      .select('office_hours_available')
      .eq('id', advisorId)
      .single()
      .then(({ data }) => {
        setOfficeHoursAvailable(data?.office_hours_available ?? false)
        setOfficeHoursLoading(false)
      })
  }, [advisorId])

  const toggleOfficeHours = async () => {
    const newVal = !officeHoursAvailable
    setOfficeHoursAvailable(newVal)
    await supabase
      .from('advisors')
      .update({ office_hours_available: newVal })
      .eq('id', advisorId)
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const addToast = useCallback((message) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  const fetchQueue = useCallback(async () => {
    if (!advisorId) return
    let query = supabase
      .from('queue')
      .select('*, college:colleges(name)')
      .in('status', ['waiting', 'in-progress'])
      .order('checked_in_at', { ascending: true })

    query = collegeId
      ? query.or(`advisor_id.eq.${advisorId},advisor_id.is.null`).eq('college_id', collegeId)
      : query.eq('advisor_id', advisorId)

    const { data, error } = await query
    if (!error) setQueue(data ?? [])
    setLoading(false)
    hasLoaded.current = true
  }, [advisorId, collegeId])

  useEffect(() => {
    if (!advisorId) return
    fetchQueue()
    const poll = setInterval(fetchQueue, 2000)
    const channel = supabase
      .channel(`advisor-queue-${advisorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue',
          filter: collegeId ? `college_id=eq.${collegeId}` : `advisor_id=eq.${advisorId}`,
        },
        (payload) => {
          const isForThisAdvisor =
            payload.new?.advisor_id === advisorId || payload.new?.advisor_id === null
          if (
            payload.eventType === 'INSERT' &&
            payload.new.status === 'waiting' &&
            isForThisAdvisor &&
            hasLoaded.current
          ) {
            const name = payload.new.student_name
            const type = payload.new.appointment_type ?? 'Drop-In'
            playChime()
            sendPushNotification(name, type)
            startFlash()
            addToast(`New check-in: ${name} (${type})`)
          }
          fetchQueue()
        }
      )
      .subscribe()
    return () => { clearInterval(poll); supabase.removeChannel(channel) }
  }, [advisorId, collegeId, fetchQueue, addToast, startFlash])

  const handleInProgress = async (id) => {
    const entry = queue.find((r) => r.id === id)
    const isNextAvailable = entry?.advisor_id === null
    let query = supabase
      .from('queue')
      .update(isNextAvailable ? { status: 'in-progress', advisor_id: advisorId } : { status: 'in-progress' })
      .eq('id', id)
    if (isNextAvailable) query = query.is('advisor_id', null)
    const { error } = await query
    if (error) return
    setQueue((prev) => prev.map((r) => r.id === id
      ? { ...r, status: 'in-progress', ...(isNextAvailable ? { advisor_id: advisorId } : {}) }
      : r))
  }

  const handleSeen = async (id) => {
    await supabase
      .from('queue')
      .update({ status: 'seen', seen_at: new Date().toISOString() })
      .eq('id', id)
    setQueue((prev) => prev.filter((r) => r.id !== id))
  }

  // Sort purely by wait time (oldest first) across all statuses
  const sorted = [...queue].sort((a, b) =>
    new Date(a.checked_in_at) - new Date(b.checked_in_at)
  )

  const waitingCount    = queue.filter((r) => r.status === 'waiting').length
  const inProgressCount = queue.filter((r) => r.status === 'in-progress').length

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <ToastList toasts={toasts} />

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Office hours availability toggle */}
        <div className="flex items-center gap-4 bg-white rounded-xl shadow px-5 py-4 mb-6">
          <div className="flex-1">
            <p className="font-semibold text-gray-800">Available for Office Hours Drop-In</p>
            <p className="text-sm text-gray-500">
              {officeHoursAvailable
                ? 'Students can select you for drop-in appointments'
                : 'You will not appear in the drop-in advisor list'}
            </p>
          </div>
          <Toggle
            checked={officeHoursAvailable}
            onChange={toggleOfficeHours}
            disabled={officeHoursLoading}
          />
        </div>

        {/* Heading + counters */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#73000a]">Your Queue</h1>
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

        {/* Seen Today */}
        <SeenTodaySection advisorId={advisorId} collegeId={collegeId} />
      </div>
    </div>
  )
}
