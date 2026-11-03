/**
 * clear-queue
 *
 * Deletes all rows from the `queue` table. Called by Power Automate
 * AFTER the nightly CSV has been successfully saved to SharePoint.
 *
 * Security: requires the service role key as the Bearer token.
 * Store it as a secured value in Power Automate — never in plain text.
 *
 * Expected request:
 *   POST /functions/v1/clear-queue
 *   Authorization: Bearer <service_role_key>
 *   Content-Type: application/json
 *   Body: {}
 *
 * Response (success):
 *   { "success": true, "cleared": 42, "clearedAt": "2026-08-25T04:00:00.000Z" }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── Auth: must be called with the service role key ─────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerToken = authHeader.replace('Bearer ', '').trim()
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!callerToken || callerToken !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Delete all queue rows ──────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    )

    // Filter on checked_in_at <= now() to safely match every live row
    // without a literal "delete everything" that PostgREST rejects.
    const { count, error } = await supabase
      .from('queue')
      .delete({ count: 'exact' })
      .lte('checked_in_at', new Date().toISOString())

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        cleared: count ?? 0,
        clearedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
