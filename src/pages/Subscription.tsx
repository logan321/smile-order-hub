import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CreditCard, Clock, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionPageProps {
  status: string;
  trialEndsAt?: string;
}

const ADMIN_WHATSAPP = '5562982193686';

const SubscriptionPage = ({ status, trialEndsAt }: SubscriptionPageProps) => {
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data?.user?.email || '');
    });
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: 'price_1T0ZgJ2Nbbg4hzJW8JEG902r',
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

  const handleWhatsAppPix = () => {
    const message = `Olá! Gostaria de assinar o plano mensal (R$ 150,00) via PIX.\n\nE-mail da conta: ${userEmail}`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encoded}`, '_blank');
  };

  const isExpiredTrial = status === 'trialing' && trialEndsAt && new Date(trialEndsAt) <= new Date();
  const isCanceled = status === 'canceled';
  const isPastDue = status === 'past_due';
  const isBlocked = status === 'blocked';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
            {isPastDue || isBlocked ? <AlertTriangle className="h-6 w-6 text-destructive" /> : <Clock className="h-6 w-6 text-warning" />}
          </div>
          <CardTitle className="text-xl">
            {isBlocked && 'Seu acesso foi bloqueado'}
            {isExpiredTrial && !isBlocked && 'Seu período de teste expirou'}
            {isCanceled && !isBlocked && 'Sua assinatura foi cancelada'}
            {isPastDue && !isBlocked && 'Pagamento pendente'}
            {!isExpiredTrial && !isCanceled && !isPastDue && !isBlocked && 'Assine para continuar'}
          </CardTitle>
          <CardDescription>
            {isBlocked && 'Entre em contato com o administrador para reativar seu acesso.'}
            {isExpiredTrial && !isBlocked && 'Assine um plano para continuar usando a plataforma.'}
            {isCanceled && !isBlocked && 'Renove sua assinatura para recuperar o acesso.'}
            {isPastDue && !isBlocked && 'Atualize seu método de pagamento para manter o acesso.'}
            {!isExpiredTrial && !isCanceled && !isPastDue && !isBlocked && 'Escolha um plano mensal para acessar todas as funcionalidades.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">Plano Mensal</p>
                <p className="text-sm text-muted-foreground">Acesso completo à plataforma</p>
              </div>
              <p className="text-2xl font-bold">R$ 150,00<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>✓ Clientes ilimitados</li>
              <li>✓ Pedidos ilimitados</li>
              <li>✓ Relatórios completos</li>
              <li>✓ Rastreio de pedidos</li>
            </ul>
          </div>

          {!isBlocked && (
            <div className="space-y-2">
              <Button onClick={handleSubscribe} className="w-full" size="lg" disabled={loading}>
                <CreditCard className="h-4 w-4 mr-2" />
                {loading ? 'Redirecionando...' : 'Pagar com Cartão / Boleto'}
              </Button>

              <div className="relative flex items-center justify-center">
                <span className="absolute bg-background px-2 text-xs text-muted-foreground">ou</span>
                <div className="w-full border-t border-border" />
              </div>

              <Button onClick={handleWhatsAppPix} variant="outline" className="w-full border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700" size="lg">
                <MessageCircle className="h-4 w-4 mr-2" />
                Pagar via PIX (WhatsApp)
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Cartão/Boleto processados via Stripe. PIX direto com o fornecedor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionPage;
