import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CreditCard, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionPageProps {
  status: string;
  trialEndsAt?: string;
}

const SubscriptionPage = ({ status, trialEndsAt }: SubscriptionPageProps) => {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: 'price_placeholder', // Will be configured
          successUrl: `${window.location.origin}/configuracoes?payment=success`,
          cancelUrl: `${window.location.origin}/assinatura?payment=cancelled`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const isExpiredTrial = status === 'trialing' && trialEndsAt && new Date(trialEndsAt) <= new Date();
  const isCanceled = status === 'canceled';
  const isPastDue = status === 'past_due';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
            {isPastDue ? <AlertTriangle className="h-6 w-6 text-destructive" /> : <Clock className="h-6 w-6 text-warning" />}
          </div>
          <CardTitle className="text-xl">
            {isExpiredTrial && 'Seu período de teste expirou'}
            {isCanceled && 'Sua assinatura foi cancelada'}
            {isPastDue && 'Pagamento pendente'}
            {!isExpiredTrial && !isCanceled && !isPastDue && 'Assine para continuar'}
          </CardTitle>
          <CardDescription>
            {isExpiredTrial && 'Assine um plano para continuar usando a plataforma.'}
            {isCanceled && 'Renove sua assinatura para recuperar o acesso.'}
            {isPastDue && 'Atualize seu método de pagamento para manter o acesso.'}
            {!isExpiredTrial && !isCanceled && !isPastDue && 'Escolha um plano mensal para acessar todas as funcionalidades.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">Plano Mensal</p>
                <p className="text-sm text-muted-foreground">Acesso completo à plataforma</p>
              </div>
              <p className="text-2xl font-bold">R$ --</p>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>✓ Clientes ilimitados</li>
              <li>✓ Pedidos ilimitados</li>
              <li>✓ Relatórios completos</li>
              <li>✓ Rastreio de pedidos</li>
            </ul>
          </div>

          <Button onClick={handleSubscribe} className="w-full" size="lg" disabled={loading}>
            <CreditCard className="h-4 w-4 mr-2" />
            {loading ? 'Redirecionando...' : 'Assinar agora'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Pagamento seguro via Stripe. Cancele a qualquer momento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionPage;
