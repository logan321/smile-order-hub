import { useState, useEffect } from 'react';
import { Order, OrderFile, OrderCustomValue } from '@/types';
import { useApp, getOrderTotal, getOrderDescription } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Eye, Image, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useOrderStages } from '@/hooks/useOrderStages';
import { loadBusinessConfig } from '@/lib/businessConfig';
import { generateOrderPreviewPDF } from '@/lib/generatePDF';
import { toast } from 'sonner';

interface OrderPreviewProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderPreview({ order, open, onOpenChange }: OrderPreviewProps) {
  const { clients, services } = useApp();
  const { stages } = useOrderStages();
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [customValues, setCustomValues] = useState<OrderCustomValue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!order || !open) return;
    setLoading(true);

    const fetchDetails = async () => {
      // Fetch files
      const { data: filesData } = await supabase
        .from('order_files')
        .select('id, file_name, file_url')
        .eq('order_id', order.id);

      setFiles((filesData ?? []).map((f: any) => ({
        id: f.id, fileName: f.file_name, fileUrl: f.file_url,
      })));

      // Fetch custom values with field names
      const { data: valuesData } = await supabase
        .from('order_custom_values')
        .select('id, value, custom_field_id')
        .eq('order_id', order.id);

      if (valuesData && valuesData.length > 0) {
        const fieldIds = [...new Set(valuesData.map((v: any) => v.custom_field_id))];
        const { data: fieldsData } = await supabase
          .from('custom_fields')
          .select('id, name')
          .in('id', fieldIds);

        setCustomValues(valuesData.map((v: any) => ({
          fieldId: v.custom_field_id,
          fieldName: fieldsData?.find((f: any) => f.id === v.custom_field_id)?.name ?? 'Campo',
          value: v.value,
        })));
      } else {
        setCustomValues([]);
      }

      setLoading(false);
    };

    fetchDetails();
  }, [order, open]);

  if (!order) return null;

  const client = clients.find(c => c.id === order.clientId);
  const isConfection = order.orderType === 'confeccao';
  const desc = getOrderDescription(order, services);
  const total = getOrderTotal(order);

  const statusOptions = stages.length > 0
    ? stages.map(s => ({ value: s.id, label: s.name }))
    : [
        { value: 'received', label: 'Recebido' },
        { value: 'in_production', label: 'Em Produção' },
        { value: 'ready', label: 'Pronto' },
        { value: 'delivered', label: 'Entregue' },
      ];
  const statusLabel = statusOptions.find(s => s.value === order.status)?.label ?? order.status;
  const currentStepIndex = statusOptions.findIndex(s => s.value === order.status);

  const handleExportPDF = async () => {
    const config = loadBusinessConfig();
    if (!config.businessName && !config.ownerName) {
      toast.warning('Configure seus dados em Configurações antes de gerar o PDF');
      return;
    }
    await generateOrderPreviewPDF(order, client, services, files, customValues, statusLabel, config);
    toast.success('PDF gerado!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview — {order.trackingId}
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">{client?.name ?? 'Cliente removido'}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                isConfection ? "bg-accent/20 text-accent-foreground" : "bg-primary/10 text-primary"
              )}>
                {isConfection ? 'Confecção' : 'Designer'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted">
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Status timeline */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Status</h3>
            <div className="flex items-center gap-1">
              {statusOptions.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <div key={step.value} className="flex items-center gap-1 flex-1">
                    <div className={cn(
                      "h-2 flex-1 rounded-full transition-all",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )} />
                    {isCurrent && (
                      <span className="text-[10px] text-primary font-medium whitespace-nowrap">{step.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Layout images */}
          {files.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
                <Image className="h-4 w-4" /> Layouts
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {files.map(file => (
                  <a key={file.id} href={file.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-colors">
                    <img src={file.fileUrl} alt={file.fileName} className="w-full h-48 object-cover" />
                    <p className="text-xs text-muted-foreground p-2 truncate">{file.fileName}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Custom fields (Ficha Técnica) */}
          {customValues.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
                <FileText className="h-4 w-4" /> Ficha Técnica
              </h3>
              <div className="bg-muted/30 rounded-lg border border-border/50 divide-y divide-border/30">
                {customValues.map(cv => (
                  <div key={cv.fieldId} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">{cv.fieldName}</span>
                    <span className="text-sm font-medium">{cv.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order items (Designer) */}
          {order.items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Itens do Pedido</h3>
              <div className="bg-muted/30 rounded-lg border border-border/50 divide-y divide-border/30">
                {order.items.map((item, i) => {
                  const svc = services.find(s => s.id === item.serviceId);
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm">{svc?.name ?? 'Serviço removido'} {item.quantity > 1 ? `(x${item.quantity})` : ''}</span>
                      <span className="text-sm font-medium">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="font-bold text-success">R$ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment status */}
          <div className="flex items-center gap-2 text-sm">
            <span className={cn(
              "px-3 py-1 rounded-full font-medium",
              order.paid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}>
              {order.paid ? '✓ Pago' : '● Pendente'}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
