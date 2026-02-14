import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error('Unauthorized');
    const userId = claimsData.claims.sub;

    // Verify admin role
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: roleData } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (!roleData) throw new Error('Forbidden: admin role required');

    // Fetch all subscriptions with user emails
    const { data: subs } = await adminSupabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    // Get user emails
    const subscribers = [];
    for (const sub of (subs || [])) {
      const { data: userData } = await adminSupabase.auth.admin.getUserById(sub.user_id);
      subscribers.push({
        ...sub,
        email: userData?.user?.email || 'N/A',
      });
    }

    return new Response(JSON.stringify({ subscribers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const status = msg.includes('Forbidden') ? 403 : 400;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
