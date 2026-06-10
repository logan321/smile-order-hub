import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    
    let event;
    if (STRIPE_WEBHOOK_SECRET && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: corsHeaders });
      }
    } else {
      console.error('STRIPE_WEBHOOK_SECRET not configured, blocking request for security');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const handleSubscriptionEvent = async (subscription: any) => {
      const customerId = subscription.customer;
      
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (!sub) {
        console.error('No subscription found for customer:', customerId);
        return;
      }

      const status = subscription.status;
      
      await supabase.from('subscriptions').update({
        stripe_subscription_id: subscription.id,
        status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      }).eq('user_id', sub.user_id);
    };

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        if (event.data.object.subscription) {
          const sub = await stripe.subscriptions.retrieve(event.data.object.subscription as string);
          await handleSubscriptionEvent(sub);
        }
        break;
      case 'invoice.payment_failed':
        if (event.data.object.subscription) {
          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', event.data.object.subscription)
            .single();
          if (existingSub) {
            await supabase.from('subscriptions').update({ status: 'past_due' }).eq('user_id', existingSub.user_id);
          }
        }
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
