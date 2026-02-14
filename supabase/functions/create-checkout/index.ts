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
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');

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

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;

    const { priceId, successUrl, cancelUrl } = await req.json();

    // Check if user already has a Stripe customer
    const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).single();

    let customerId = sub?.stripe_customer_id;

    if (!customerId) {
      // Create Stripe customer
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ email: email || '', 'metadata[user_id]': userId }),
      });
      const customer = await customerRes.json();
      if (!customerRes.ok) throw new Error(`Stripe customer error: ${JSON.stringify(customer)}`);
      customerId = customer.id;

      // Update subscription record
      const adminSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await adminSupabase.from('subscriptions').update({ stripe_customer_id: customerId }).eq('user_id', userId);
    }

    // Create checkout session
    const params = new URLSearchParams({
      'customer': customerId,
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': successUrl || `${req.headers.get('origin')}/configuracoes?payment=success`,
      'cancel_url': cancelUrl || `${req.headers.get('origin')}/configuracoes?payment=cancelled`,
      'subscription_data[trial_period_days]': '7',
      'metadata[user_id]': userId,
    });

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const session = await sessionRes.json();
    if (!sessionRes.ok) throw new Error(`Stripe session error: ${JSON.stringify(session)}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
