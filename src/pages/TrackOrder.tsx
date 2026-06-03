import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Package, CircleDot, Image, FileText, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DEFAULT_STATUS_STEPS = [
  { key: 'received', label: 'Recebido', description: 'Pedido recebido' },
  { key: 'in_production', label: 'Em Produção', description: 'Seu pedido está sendo produzido' },
  { key: 'ready', label: 'Pronto', description: 'Pedido finalizado, pronto para retirada/entrega' },
  { key: 'delivered', label: 'Entregue', description: 'Pedido entregue' },
];

interface StageStep { key: string; label: string; description: string; }
interface OrderFile { id: string; fileName: string; fileUrl: string; }
interface CustomValue { fieldName: string; value: string; }

interface OrderResult {
  tracking_id: string;
  status: string;
  date: string;
  created_at: string;
  user_id: string;
  order_type: string;
  delivery_date: string | null;
  items: { service_name: string; quantity: number; unit_price: number }[];
  files: OrderFile[];
  customValues: CustomValue[];
}

const TrackOrder = () => {
  const { slug } = useParams<{ slug: string }>();
  const [trackingId, setTrackingId] = useState('');
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [statusSteps, setStatusSteps] = useState<StageStep[]>(DEFAULT_STATUS_STEPS);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [slugValid, setSlugValid] = useState<boolean | null>(null);

  // Resolve slug to user_id
  useEffect(() => {
    if (!slug) { setSlugValid(false); return; }
    const resolve = async () => {
      const { data } = await supabase.rpc('get_tracking_owner', { _slug: slug.toLowerCase() });
      if (data) {
        setOwnerUserId(data as string);
        setSlugValid(true);
      } else {
        setSlugValid(false);
      }
    };
    resolve();
  }, [slug]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = trackingId.trim().toUpperCase();
    if (!id || !ownerUserId) return;

    setLoading(true);
    setSearched(true);
    setOrder(null);

    try {
      const { data: orderRows, error } = await supabase.rpc('get_public_order', { _tracking_id: id, _owner: ownerUserId });
      if (error) throw error;
      const orderData: any = Array.isArray(orderRows) ? orderRows[0] : orderRows;
      if (!orderData) { setOrder(null); return; }

      const orderId = orderData.order_id;

      const [itemsRes, filesRes, customRes, stagesRes] = await Promise.all([
        supabase.rpc('get_public_order_items', { _order_id: orderId }),
        supabase.rpc('get_public_order_files', { _order_id: orderId }),
        supabase.rpc('get_public_order_custom_values', { _order_id: orderId }),
        supabase.rpc('get_public_order_stages', { _owner: orderData.user_id }),
      ]);

      const itemsWithNames: OrderResult['items'] = (itemsRes.data ?? []).map((item: any) => ({
        service_name: item.service_name ?? 'Serviço',
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
      }));

      const customValues: CustomValue[] = (customRes.data ?? []).map((v: any) => ({
        fieldName: v.field_name ?? 'Campo',
        value: v.value,
      }));

      const files: OrderFile[] = (filesRes.data ?? []).map((f: any) => ({
        id: f.file_id, fileName: f.file_name, fileUrl: f.file_url,
      }));

      if (stagesRes.data && stagesRes.data.length > 0) {
        setStatusSteps(stagesRes.data.map((s: any) => ({ key: s.stage_id, label: s.name, description: s.name })));
      } else {
        setStatusSteps(DEFAULT_STATUS_STEPS);
      }

      setOrder({
        tracking_id: orderData.tracking_id,
        status: orderData.status,
        date: orderData.order_date,
        created_at: orderData.created_at,
        user_id: orderData.user_id,
        order_type: orderData.order_type,
        delivery_date: orderData.delivery_date ?? null,
        items: itemsWithNames,
        files,
        customValues,
      });
    } catch (err) {
      console.error(err);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = order ? statusSteps.findIndex(s => s.key === order.status) : -1;

  if (slugValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (slugValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <p className="text-lg font-medium">Link de rastreio inválido</p>
          <p className="text-sm text-muted-foreground mt-1">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <img src={logo} alt="Macro Master" className="h-10 w-auto mx-auto mb-2" />
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
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    order.order_type === 'confeccao' ? "bg-accent/20 text-accent-foreground" : "bg-primary/10 text-primary"
                  )}>
                    {order.order_type === 'confeccao' ? 'Confecção' : 'Designer'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                {order.delivery_date && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-primary font-medium">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Entrega: {format(new Date(order.delivery_date), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                )}
              </div>
            </div>

            {/* Layout images */}
            {order.files.length > 0 && (
              <div className="p-6 border-b border-border/50">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
                  <Image className="h-4 w-4" /> Layouts
                </h3>
                <div className={cn(
                  "grid gap-3",
                  order.files.length === 1 ? "grid-cols-1" : "grid-cols-2"
                )}>
                  {order.files.map(file => (
                    <a key={file.id} href={file.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="block rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-colors bg-muted/20">
                      <div className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden">
                        <img src={file.fileUrl} alt={file.fileName} className="max-w-full max-h-full object-contain" />
                      </div>
                      <p className="text-xs text-muted-foreground p-2 truncate">{file.fileName}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Custom fields (Ficha Técnica) */}
            {order.customValues.length > 0 && (
              <div className="p-6 border-b border-border/50">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
                  <FileText className="h-4 w-4" /> Ficha Técnica
                </h3>
                <div className="bg-muted/30 rounded-lg border border-border/50 divide-y divide-border/30">
                  {order.customValues.map((cv, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">{cv.fieldName}</span>
                      <span className="text-sm font-medium">{cv.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status timeline */}
            <div className="p-6">
              <h3 className="text-sm font-semibold mb-6">Status do Pedido</h3>
              <div className="space-y-0">
                {statusSteps.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <div key={step.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                          isCurrent ? "bg-primary border-primary text-primary-foreground scale-110" :
                          isCompleted ? "bg-primary/20 border-primary text-primary" :
                          "bg-muted border-border text-muted-foreground"
                        )}>
                          <CircleDot className="h-4 w-4" />
                        </div>
                        {index < statusSteps.length - 1 && (
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
