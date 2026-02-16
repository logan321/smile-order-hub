import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');

    console.log('STRIPE_SECRET_KEY prefix:', STRIPE_SECRET_KEY.substring(0, 7));

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error('Unauthorized: ' + (userError?.message || 'no user'));
    const userId = userData.user.id;
    const email = userData.user.email;

    console.log('User:', userId, email);

    const { priceId, successUrl, cancelUrl } = await req.json();
    console.log('PriceId:', priceId);

    // Check if user already has a Stripe customer
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: sub } = await adminSupabase.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).single();

    let customerId = sub?.stripe_customer_id;
    console.log('Existing customer:', customerId);

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
      const customerText = await customerRes.text();
      console.log('Stripe customer response:', customerRes.status, customerText);
      
      if (!customerRes.ok) throw new Error(`Stripe customer error: ${customerText}`);
      
      const customer = JSON.parse(customerText);
      customerId = customer.id;

      await adminSupabase.from('subscriptions').update({ stripe_customer_id: customerId }).eq('user_id', userId);
    }

    // Create checkout session
    const params = new URLSearchParams({
      'customer': customerId,
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': successUrl || `${req.headers.get('origin')}/configuracoes?payment=success`,
      'cancel_url': cancelUrl || `${req.headers.get('origin')}/assinatura?payment=cancelled`,
      'subscription_data[trial_period_days]': '7',
      'metadata[user_id]': userId,
    });

    console.log('Creating checkout session...');
    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const sessionText = await sessionRes.text();
    console.log('Stripe session response:', sessionRes.status, sessionText);

    if (!sessionRes.ok) throw new Error(`Stripe session error: ${sessionText}`);

    const session = JSON.parse(sessionText);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('create-checkout error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
