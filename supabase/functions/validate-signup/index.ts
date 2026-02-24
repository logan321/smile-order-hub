import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'hotmail.com.br',
  'outlook.com',
  'outlook.com.br',
  'live.com',
  'msn.com',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fingerprint } = await req.json();

    if (!email || !fingerprint) {
      return new Response(JSON.stringify({ allowed: false, reason: 'Dados incompletos' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Check email domain
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: 'Utilize um e-mail Gmail, Hotmail ou Outlook para se cadastrar.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Check fingerprint for previous trial usage
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existing } = await adminSupabase
      .from('trial_fingerprints')
      .select('id, email')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: 'Este dispositivo já utilizou o período de teste. Assine um plano para continuar.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. All good — register fingerprint
    await adminSupabase.from('trial_fingerprints').insert({
      fingerprint,
      email: email.toLowerCase(),
    });

    return new Response(JSON.stringify({ allowed: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ allowed: false, reason: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
