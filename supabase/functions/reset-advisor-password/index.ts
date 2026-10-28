import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_ROLES = ['platform_admin', 'system_admin']
const DEFAULT_PASSWORD = 'uackiosk' // same default used by create-advisor

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Not authenticated')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify caller is a logged-in admin
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) throw new Error('Invalid token')

    const { data: caller } = await supabaseAdmin
      .from('advisors')
      .select('role, school_id')
      .eq('email', user.email?.toLowerCase())
      .maybeSingle()
    if (!caller || !ADMIN_ROLES.includes(caller.role)) {
      throw new Error('Forbidden: admin role required')
    }

    const { advisor_id } = await req.json()
    if (!advisor_id) throw new Error('advisor_id is required')

    const { data: target } = await supabaseAdmin
      .from('advisors')
      .select('id, email, role, school_id')
      .eq('id', advisor_id)
      .maybeSingle()
    if (!target) throw new Error('Advisor not found')

    // A system_admin may only reset accounts in their own school, and may
    // never reset a platform_admin (that would let them take over the account
    // using the known default password).
    if (caller.role === 'system_admin') {
      if (target.school_id !== caller.school_id) {
        throw new Error('Forbidden: advisor belongs to a different school')
      }
      if (target.role === 'platform_admin') {
        throw new Error('Forbidden: only a platform admin can reset a platform admin password')
      }
    }

    // Find the auth user by email (paginate through listUsers)
    const targetEmail = target.email.trim().toLowerCase()
    let authUserId: string | null = null
    for (let page = 1; page <= 50 && !authUserId; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail)
      if (match) authUserId = match.id
      if (data.users.length < 1000) break
    }
    if (!authUserId) throw new Error('No login account exists for this advisor')

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password: DEFAULT_PASSWORD,
    })
    if (updErr) throw updErr

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
