import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Package, Clock, Cog, CheckCircle2, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_STEPS = [
  { key: 'received', label: 'Recebido', icon: Clock, description: 'Pedido recebido' },
  { key: 'in_production', label: 'Em Produção', icon: Cog, description: 'Seu pedido está sendo produzido' },
  { key: 'ready', label: 'Pronto', icon: CheckCircle2, description: 'Pedido finalizado, pronto para retirada/entrega' },
  { key: 'delivered', label: 'Entregue', icon: Truck, description: 'Pedido entregue' },
];

interface OrderResult {
  tracking_id: string;
  status: string;
  date: string;
  created_at: string;
  items: { service_name: string; quantity: number; unit_price: number }[];
}

const TrackOrder = () => {
  const [trackingId, setTrackingId] = useState('');
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = trackingId.trim().toUpperCase();
    if (!id) return;

    setLoading(true);
    setSearched(true);
    setOrder(null);

    try {
      // Fetch order
      const { data: orderData, error } = await supabase
        .from('orders')
        .select('tracking_id, status, date, created_at')
        .eq('tracking_id', id)
        .maybeSingle();

      if (error) throw error;
      if (!orderData) {
        setOrder(null);
        return;
      }

      // Fetch order items with service names
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, unit_price, service_id')
        .eq('order_id', (await supabase.from('orders').select('id').eq('tracking_id', id).single()).data?.id ?? '');

      // Fetch service names
      let itemsWithNames: OrderResult['items'] = [];
      if (items && items.length > 0) {
        const serviceIds = [...new Set(items.map(i => i.service_id))];
        const { data: svcs } = await supabase
          .from('services')
          .select('id, name')
          .in('id', serviceIds);

        itemsWithNames = items.map(item => {
          const svc = svcs?.find((s: any) => s.id === item.service_id);
          return {
            service_name: svc?.name ?? 'Serviço',
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
          };
        });
      }

      setOrder({
        tracking_id: orderData.tracking_id,
        status: orderData.status,
        date: orderData.date,
        created_at: orderData.created_at,
        items: itemsWithNames,
      });
    } catch (err) {
      console.error(err);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = order ? STATUS_STEPS.findIndex(s => s.key === order.status) : -1;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold font-display">
            <span className="text-accent">●</span> GestãoPro
          </h1>
          <p className="text-muted-foreground mt-2">Acompanhe o status do seu pedido</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={trackingId}
              onChange={e => setTrackingId(e.target.value)}
              placeholder="Digite o ID do pedido (ex: PED-00001)"
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>
        </form>

        {searched && !loading && !order && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Pedido não encontrado</p>
            <p className="text-sm mt-1">Verifique o ID e tente novamente</p>
          </div>
        )}

        {order && (
          <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold font-display">{order.tracking_id}</h2>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>

            {/* Status timeline */}
            <div className="p-6">
              <h3 className="text-sm font-semibold mb-6">Status do Pedido</h3>
              <div className="space-y-0">
                {STATUS_STEPS.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                          isCurrent ? "bg-primary border-primary text-primary-foreground scale-110" :
                          isCompleted ? "bg-primary/20 border-primary text-primary" :
                          "bg-muted border-border text-muted-foreground"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {index < STATUS_STEPS.length - 1 && (
                          <div className={cn("w-0.5 h-8", isCompleted ? "bg-primary" : "bg-border")} />
                        )}
                      </div>
                      <div className="pt-2 pb-4">
                        <p className={cn("text-sm font-medium", isCurrent ? "text-foreground" : isCompleted ? "text-foreground" : "text-muted-foreground")}>
                          {step.label}
                        </p>
                        {isCurrent && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Items */}
            {order.items.length > 0 && (
              <div className="border-t border-border/50 p-6">
                <h3 className="text-sm font-semibold mb-3">Itens do Pedido</h3>
                <div className="space-y-2">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{item.service_name} {item.quantity > 1 ? `(x${item.quantity})` : ''}</span>
                      <span className="font-medium">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border/30 flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-success">
                      R$ {order.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-center mt-8">
          <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Área administrativa →
          </a>
        </div>
      </div>
    </div>
  );
};

export default TrackOrder;
