import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionStatus {
  active: boolean;
  isAdmin: boolean;
  status: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  loading: boolean;
}

export function useSubscription() {
  const [sub, setSub] = useState<SubscriptionStatus>({
    active: true, isAdmin: false, status: 'loading', loading: true,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSub({ active: false, isAdmin: false, status: 'unauthenticated', loading: false });
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;

      setSub({
        active: data.active,
        isAdmin: data.isAdmin,
        status: data.status,
        trialEndsAt: data.trialEndsAt,
        currentPeriodEnd: data.currentPeriodEnd,
        loading: false,
      });
    } catch (err) {
      console.error('Error checking subscription:', err);
      setSub({ active: true, isAdmin: false, status: 'error', loading: false });
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return { ...sub, refresh: checkSubscription };
}
