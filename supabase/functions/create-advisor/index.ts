import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const { data: profile } = await supabaseAdmin
      .from('advisors')
      .select('role')
      .eq('email', user.email?.toLowerCase())
      .maybeSingle()
    if (profile?.role !== 'admin') throw new Error('Forbidden: admin role required')

    const { name, email, college_id, role } = await req.json()
    if (!name || !email) throw new Error('Name and email are required')

    const normalizedEmail = email.trim().toLowerCase()

    // 1. Create the auth account with default password
    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: 'uackiosk',
      email_confirm: true,
    })
    if (createErr) {
      // If user already exists in auth, continue — they may just need the advisors row
      if (!createErr.message.toLowerCase().includes('already been registered')) {
        throw createErr
      }
    }

    // 2. Insert into advisors table
    const { error: dbErr } = await supabaseAdmin.from('advisors').insert([{
      name:       name.trim(),
      email:      normalizedEmail,
      college_id: college_id || null,
      role:       role || 'advisor',
      is_active:  true,
    }])
    if (dbErr) {
      // If auth user was just created but DB insert fails, clean up the auth user
      if (authData?.user?.id) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      }
      if (dbErr.code === '23505') throw new Error('An advisor with this email already exists.')
      throw new Error(dbErr.message)
    }

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
