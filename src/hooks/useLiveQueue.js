import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

// Columns the UI renders or filters on. Keep in sync with the queue table;
// `major` is intentionally omitted because no screen displays it.
export const QUEUE_COLUMNS =
  'id, student_name, student_email, appointment_type, checked_in_at, in_progress_at, seen_at, status, notes, advisor_id, seen_by_advisor_id, college_id, school_id'

const BACKSTOP_MS  = 3 * 60 * 1000
const MIN_GAP_MS   = 2000
const INITIAL_WAIT = 2500

export const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const byCheckedInAsc = (a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at)
const bySeenAtDesc   = (a, b) => new Date(b.seen_at) - new Date(a.seen_at)

const LOOKUP_QUERIES = {
  colleges: () => supabase.from('colleges').select('id, name'),
  advisors: () => supabase.from('advisors').select('id, name, is_uac_suite, ea_suite'),
  schools:  () => supabase.from('schools').select('id, name'),
}

// Small id -> row maps used to fill in joined names, which Realtime payloads lack.
export async function fetchQueueLookups(kinds) {
  const results = await Promise.all(kinds.map((k) => LOOKUP_QUERIES[k]()))
  const out = {}
  kinds.forEach((k, i) => {
    out[k] = new Map((results[i].data ?? []).map((row) => [row.id, row]))
  })
  return out
}

/**
 * Loads the queue once, then keeps it current from Realtime events.
 *
 * options:
 *   enabled      skip everything while false
 *   channelName  unique channel name; must change when any input below changes
 *   filter       optional postgres_changes filter, e.g. `college_id=eq.<id>`
 *   fetchData    async () => ({ active, seen }) | null   (REST, joined rows)
 *   lookupKinds  which of 'colleges' | 'advisors' | 'schools' resolve() needs
 *   resolve      (rawRow, lookups) => decorated row | false (out of scope) | null (lookup missing)
 *   onInsert     optional (decoratedRow) called for in-scope INSERT events after first load
 */
export function useLiveQueue(options) {
  const { enabled = true, channelName, filter } = options
  const optsRef = useRef(options)
  optsRef.current = options

  const [active, setActive]   = useState([])
  const [seen, setSeen]       = useState([])
  const [loading, setLoading] = useState(true)

  const lookupsRef  = useRef({})
  const applyRef    = useRef(() => {})
  const refetchRef  = useRef(async () => {})

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled  = false
    let loadedOnce = false
    let lastFetch  = 0
    let inFlight   = null
    let lookupsOk  = false

    const removeById = (id) => {
      setActive((prev) => (prev.some((r) => r.id === id) ? prev.filter((r) => r.id !== id) : prev))
      setSeen((prev)   => (prev.some((r) => r.id === id) ? prev.filter((r) => r.id !== id) : prev))
    }

    const refetch = async ({ force = false, lookups = false } = {}) => {
      if (cancelled) return
      if (inFlight) return inFlight
      if (!force && Date.now() - lastFetch < MIN_GAP_MS) return
      inFlight = (async () => {
        try {
          const { fetchData, lookupKinds } = optsRef.current
          const needLookups = lookupKinds?.length && (lookups || !lookupsOk)
          const [lk, data] = await Promise.all([
            needLookups ? fetchQueueLookups(lookupKinds) : null,
            fetchData(),
          ])
          if (cancelled) return
          if (lk) { lookupsRef.current = lk; lookupsOk = true }
          if (data) {
            setActive([...data.active].sort(byCheckedInAsc))
            setSeen([...data.seen].sort(bySeenAtDesc))
            loadedOnce = true
            setLoading(false)
          }
        } finally {
          lastFetch = Date.now()
          inFlight = null
        }
      })()
      return inFlight
    }

    // Applies one raw queue row (from Realtime or a local optimistic update).
    const apply = (raw, { fromInsert = false } = {}) => {
      const resolved = optsRef.current.resolve(raw, lookupsRef.current)
      if (resolved === null) { refetch({ force: true, lookups: true }); return }
      if (resolved === false) { removeById(raw.id); return }

      const isActive = resolved.status === 'waiting' || resolved.status === 'in-progress'
      const isSeen   = resolved.status === 'seen' && resolved.seen_at &&
                       new Date(resolved.seen_at) >= startOfToday()

      const upsert = (prev, sorter) => {
        const next = prev.some((r) => r.id === resolved.id)
          ? prev.map((r) => (r.id === resolved.id ? { ...r, ...resolved } : r))
          : [...prev, resolved]
        return next.sort(sorter)
      }
      const drop = (prev) => (prev.some((r) => r.id === resolved.id) ? prev.filter((r) => r.id !== resolved.id) : prev)

      setActive((prev) => (isActive ? upsert([...prev], byCheckedInAsc) : drop(prev)))
      setSeen((prev)   => (isSeen   ? upsert([...prev], bySeenAtDesc)   : drop(prev)))

      if (fromInsert && loadedOnce) optsRef.current.onInsert?.(resolved)
    }

    applyRef.current   = apply
    refetchRef.current = refetch

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue', ...(filter ? { filter } : {}) },
        (payload) => {
          if (payload.eventType === 'DELETE') { removeById(payload.old?.id); return }
          apply(payload.new, { fromInsert: payload.eventType === 'INSERT' })
        }
      )
      // DELETE payloads only carry the primary key, so column filters cannot
      // match them. Listen unfiltered; only the id is exposed.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'queue' },
        (payload) => removeById(payload.old?.id)
      )
      .subscribe((status) => {
        // Fires on first subscribe and on every automatic rejoin after a drop.
        if (status === 'SUBSCRIBED') refetch({ force: true, lookups: true })
      })

    // If Realtime never connects, still show data.
    const initialTimer = setTimeout(() => { if (!loadedOnce) refetch({ force: true }) }, INITIAL_WAIT)

    const onVisible = () => { if (document.visibilityState === 'visible') refetch() }
    const onFocus   = () => refetch()
    const onOnline  = () => refetch({ force: true })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)

    const backstop = setInterval(() => {
      if (document.visibilityState === 'visible') refetch({ force: true, lookups: true })
    }, BACKSTOP_MS)

    return () => {
      cancelled = true
      clearTimeout(initialTimer)
      clearInterval(backstop)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
      supabase.removeChannel(channel)
      applyRef.current   = () => {}
      refetchRef.current = async () => {}
    }
  }, [enabled, channelName, filter])

  const applyRow = useCallback((row) => applyRef.current(row), [])
  const refetch  = useCallback(() => refetchRef.current({ force: true }), [])

  return { active, seen, loading, applyRow, refetch }
}
