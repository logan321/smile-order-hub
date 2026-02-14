import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Package, CircleDot, Image, FileText } from 'lucide-react';
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
  items: { service_name: string; quantity: number; unit_price: number }[];
  files: OrderFile[];
  customValues: CustomValue[];
}

const TrackOrder = () => {
  const [trackingId, setTrackingId] = useState('');
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [statusSteps, setStatusSteps] = useState<StageStep[]>(DEFAULT_STATUS_STEPS);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = trackingId.trim().toUpperCase();
    if (!id) return;

    setLoading(true);
    setSearched(true);
    setOrder(null);

    try {
      const { data: orderData, error } = await supabase
        .from('orders')
        .select('id, tracking_id, status, date, created_at, user_id, order_type')
        .eq('tracking_id', id)
        .maybeSingle();

      if (error) throw error;
      if (!orderData) { setOrder(null); return; }

      // Fetch items, files, custom values, and stages in parallel
      const [itemsRes, filesRes, customRes, stagesRes] = await Promise.all([
        supabase.from('order_items').select('quantity, unit_price, service_id').eq('order_id', orderData.id),
        supabase.from('order_files').select('id, file_name, file_url').eq('order_id', orderData.id),
        supabase.from('order_custom_values').select('value, custom_field_id').eq('order_id', orderData.id),
        supabase.from('order_stages').select('*').eq('user_id', orderData.user_id).order('position', { ascending: true }),
      ]);

      // Resolve service names
      let itemsWithNames: OrderResult['items'] = [];
      if (itemsRes.data && itemsRes.data.length > 0) {
        const serviceIds = [...new Set(itemsRes.data.map(i => i.service_id))];
        const { data: svcs } = await supabase.from('services').select('id, name').in('id', serviceIds);
        itemsWithNames = itemsRes.data.map(item => ({
          service_name: svcs?.find((s: any) => s.id === item.service_id)?.name ?? 'Serviço',
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
        }));
      }

      // Resolve custom field names
      let customValues: CustomValue[] = [];
      if (customRes.data && customRes.data.length > 0) {
        const fieldIds = [...new Set(customRes.data.map(v => v.custom_field_id))];
        const { data: fieldsData } = await supabase.from('custom_fields').select('id, name').in('id', fieldIds);
        customValues = customRes.data.map(v => ({
          fieldName: fieldsData?.find((f: any) => f.id === v.custom_field_id)?.name ?? 'Campo',
          value: v.value,
        }));
      }

      // Files
      const files: OrderFile[] = (filesRes.data ?? []).map((f: any) => ({
        id: f.id, fileName: f.file_name, fileUrl: f.file_url,
      }));

      // Stages
      if (stagesRes.data && stagesRes.data.length > 0) {
        setStatusSteps(stagesRes.data.map((s: any) => ({ key: s.id, label: s.name, description: s.name })));
      } else {
        setStatusSteps(DEFAULT_STATUS_STEPS);
      }

      setOrder({
        tracking_id: orderData.tracking_id,
        status: orderData.status,
        date: orderData.date,
        created_at: orderData.created_at,
        user_id: orderData.user_id,
        order_type: orderData.order_type,
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
              </div>
            </div>

            {/* Layout images */}
            {order.files.length > 0 && (
              <div className="p-6 border-b border-border/50">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
                  <Image className="h-4 w-4" /> Layouts
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {order.files.map(file => (
                    <a key={file.id} href={file.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="block rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-colors">
                      <img src={file.fileUrl} alt={file.fileName} className="w-full h-40 object-cover" />
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
