/**
 * download-queue-archive
 *
 * Admin-only Edge Function that returns a past day's queue data as a CSV
 * download.
 *
 * Usage:
 *   GET /functions/v1/download-queue-archive?date=2026-08-24
 *
 * The `date` param is optional — omitting it defaults to yesterday (Eastern time).
 * The caller must supply a valid admin Bearer token in the Authorization header.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ISO date for yesterday in Eastern time (handles both EDT and EST via a
// fixed -4 h offset; adjust to -5 if you prefer EST year-round).
function yesterdayEastern(): string {
  const now = new Date()
  // Shift to Eastern (UTC-4 for EDT; use -5 for EST)
  now.setUTCHours(now.getUTCHours() - 4)
  now.setDate(now.getDate() - 1)
  return now.toISOString().slice(0, 10)
}

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [
    columns.join(','),
    ...rows.map((r) => columns.map((c) => escape(r[c])).join(',')),
  ].join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Not authenticated')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authErr || !user) throw new Error('Invalid token')

    const { data: profile } = await supabase
      .from('advisors')
      .select('role')
      .eq('email', user.email?.toLowerCase() ?? '')
      .maybeSingle()
    if (!['platform_admin', 'system_admin'].includes(profile?.role)) throw new Error('Forbidden: admin role required')

    // ── Date param ────────────────────────────────────────────────────────────
    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const targetDate =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : yesterdayEastern()

    // ── Query archive ─────────────────────────────────────────────────────────
    const columns = [
      'id',
      'student_name',
      'student_email',
      'advisor_id',
      'college_id',
      'major',
      'appointment_type',
      'status',
      'checked_in_at',
      'archived_date',
    ]

    const { data: rows, error: fetchErr } = await supabase
      .from('archive_queue')
      .select(columns.join(', '))
      .eq('archived_date', targetDate)
      .order('checked_in_at', { ascending: true })

    if (fetchErr) throw fetchErr

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: `No archive found for ${targetDate}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Return CSV ────────────────────────────────────────────────────────────
    const csv = toCSV(rows as Record<string, unknown>[], columns)

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="queue-archive-${targetDate}.csv"`,
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
