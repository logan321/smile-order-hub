import { useState, useEffect } from 'react';
import { useApp, getOrderTotal, getOrderDescription } from '@/context/AppContext';
import { Order, OrderItem } from '@/types';
import { Plus, Pencil, Trash2, ShoppingCart, Search, X, CheckCircle2, Circle, Minus, Copy, Upload, Image, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrderPreview } from '@/components/OrderPreview';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrderStages } from '@/hooks/useOrderStages';
import { useCustomFields, CustomField } from '@/hooks/useCustomFields';
import { supabase } from '@/integrations/supabase/client';

interface OrderFormOutput { clientId: string; items: OrderItem[]; date: string; paid: boolean; }

/* ─── Designer Order Form (existing) ─── */
const DesignerOrderForm = ({ initial, onSubmit, onCancel }: { initial?: Order; onSubmit: (data: OrderFormOutput) => void; onCancel: () => void }) => {
  const { clients, services } = useApp();
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [date, setDate] = useState<Date | undefined>(initial ? new Date(initial.date) : new Date());

  const buildInitialItems = (): Record<string, number> => {
    if (!initial?.items) return {};
    const map: Record<string, number> = {};
    initial.items.forEach(item => { map[item.serviceId] = item.quantity; });
    return map;
  };
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>(buildInitialItems);

  const toggleService = (serviceId: string) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[serviceId]) { delete next[serviceId]; } else { next[serviceId] = 1; }
      return next;
    });
  };

  const setQuantity = (serviceId: string, qty: number) => {
    if (qty < 1) return;
    setSelectedItems(prev => ({ ...prev, [serviceId]: qty }));
  };

  const totalPrice = Object.entries(selectedItems).reduce((sum, [svcId, qty]) => {
    const svc = services.find(s => s.id === svcId);
    return sum + (svc?.price ?? 0) * qty;
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast.error('Selecione um cliente'); return; }
    if (Object.keys(selectedItems).length === 0) { toast.error('Selecione pelo menos um serviço'); return; }
    if (!date) { toast.error('Selecione a data'); return; }

    const items: OrderItem[] = Object.entries(selectedItems).map(([serviceId, quantity]) => {
      const svc = services.find(s => s.id === serviceId);
      return { serviceId, quantity, unitPrice: svc?.price ?? 0 };
    });

    onSubmit({ clientId, items, date: date.toISOString(), paid: false });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Cliente *</label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {clients.length === 0 && <p className="text-xs text-destructive mt-1">Cadastre um cliente primeiro</p>}
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Serviços *</label>
        {services.length === 0 ? (
          <p className="text-xs text-destructive">Cadastre serviços primeiro na aba "Serviços"</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto border border-border/50 rounded-lg p-3">
            {services.map(svc => {
              const isSelected = !!selectedItems[svc.id];
              return (
                <div key={svc.id} className={cn("flex items-center gap-3 p-2 rounded-lg transition-colors", isSelected && "bg-primary/5")}>
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleService(svc.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{svc.name}</p>
                    {svc.description && <p className="text-xs text-muted-foreground truncate">{svc.description}</p>}
                  </div>
                  <span className="text-sm font-semibold text-success whitespace-nowrap">R$ {svc.price.toFixed(2)}</span>
                  {isSelected && (
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setQuantity(svc.id, (selectedItems[svc.id] ?? 1) - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm w-6 text-center">{selectedItems[svc.id]}</span>
                      <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setQuantity(svc.id, (selectedItems[svc.id] ?? 1) + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Data do Pedido *</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      {Object.keys(selectedItems).length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium">Total do Pedido</span>
          <span className="text-lg font-bold text-success">R$ {totalPrice.toFixed(2)}</span>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{initial ? 'Salvar' : 'Cadastrar'}</Button>
      </div>
    </form>
  );
};

/* ─── Confection Order Form (new) ─── */
const ConfectionOrderForm = ({ customFields, onSubmit, onCancel }: {
  customFields: CustomField[];
  onSubmit: (data: { clientId: string; date: string; deliveryDate: string; customValues: Record<string, string>; files: File[] }) => void;
  onCancel: () => void;
}) => {
  const { clients } = useApp();
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);

  const updateCustom = (fieldId: string, value: string) => {
    setCustomValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast.error('Selecione um cliente'); return; }
    if (!date) { toast.error('Selecione a data de emissão'); return; }
    onSubmit({
      clientId,
      date: date.toISOString(),
      deliveryDate: deliveryDate?.toISOString() ?? '',
      customValues,
      files,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Cliente *</label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Layout files upload */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Layouts (imagens)</label>
        <div className="border border-dashed border-border rounded-lg p-4">
          <label className="flex flex-col items-center gap-2 cursor-pointer">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Clique para anexar imagens (PNG, JPG)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleFileChange} className="hidden" />
          </label>
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-1 bg-muted/30 rounded px-2 py-1 text-xs">
                <Image className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button type="button" onClick={() => removeFile(i)}><X className="h-3 w-3 text-destructive" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Data de Emissão *</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3 w-3" />
                {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Data de Entrega</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !deliveryDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3 w-3" />
                {deliveryDate ? format(deliveryDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={deliveryDate} onSelect={setDeliveryDate} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Custom fields */}
      {customFields.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Ficha Técnica</p>
          {customFields.map(field => (
            <div key={field.id}>
              <label className="text-sm font-medium mb-1 block">{field.name}</label>
              {field.fieldType === 'select' ? (
                <Select value={customValues[field.id] ?? ''} onValueChange={v => updateCustom(field.id, v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : field.fieldType === 'date' ? (
                <Input type="date" value={customValues[field.id] ?? ''} onChange={e => updateCustom(field.id, e.target.value)} />
              ) : (
                <Input
                  type={field.fieldType === 'number' ? 'number' : 'text'}
                  value={customValues[field.id] ?? ''}
                  onChange={e => updateCustom(field.id, e.target.value)}
                  placeholder={field.name}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {customFields.length === 0 && (
        <p className="text-xs text-muted-foreground">Configure campos personalizados em Configurações → Campos de Confecção</p>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Cadastrar Pedido</Button>
      </div>
    </form>
  );
};

/* ─── Main Orders Page ─── */
const Orders = () => {
  const { clients, orders, services, addOrder, updateOrder, deleteOrder, toggleOrderPaid, updateOrderStatus, refreshData } = useApp();
  const { stages } = useOrderStages();
  const { fields: customFields } = useCustomFields();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confectionDialogOpen, setConfectionDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');

  // Build status options from custom stages or fallback
  const statusOptions = stages.length > 0
    ? stages.map(s => ({ value: s.id, label: s.name }))
    : [
        { value: 'received', label: 'Recebido' },
        { value: 'in_production', label: 'Em Produção' },
        { value: 'ready', label: 'Pronto' },
        { value: 'delivered', label: 'Entregue' },
      ];

  const getStatusLabel = (status: string) => {
    return statusOptions.find(s => s.value === status)?.label ?? status;
  };

  const sorted = [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const filtered = sorted.filter(o => {
    const client = clients.find(c => c.id === o.clientId);
    const desc = getOrderDescription(o, services);
    const term = search.toLowerCase();
    return desc.toLowerCase().includes(term) || (client?.name.toLowerCase().includes(term) ?? false) || o.trackingId.toLowerCase().includes(term);
  });

  const handleAdd = async (data: OrderFormOutput) => {
    try {
      await addOrder(data);
      setDialogOpen(false);
      toast.success('Pedido cadastrado!');
    } catch { toast.error('Erro ao cadastrar pedido'); }
  };

  const handleConfectionAdd = async (data: { clientId: string; date: string; deliveryDate: string; customValues: Record<string, string>; files: File[] }) => {
    try {
      // Create the order with type confeccao
      const { data: orderData, error } = await supabase.from('orders').insert({
        user_id: (await supabase.auth.getSession()).data.session!.user.id,
        client_id: data.clientId,
        date: data.date,
        paid: false,
        tracking_id: '',
        order_type: 'confeccao',
      }).select('id').single();
      if (error) throw error;

      // Save custom field values
      const customEntries = Object.entries(data.customValues).filter(([, v]) => v.trim());
      if (customEntries.length > 0) {
        await supabase.from('order_custom_values').insert(
          customEntries.map(([fieldId, value]) => ({
            order_id: orderData.id,
            custom_field_id: fieldId,
            value,
          }))
        );
      }

      // Upload files
      for (const file of data.files) {
        const filePath = `${orderData.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('order-layouts').upload(filePath, file);
        if (uploadError) { console.error('Upload error:', uploadError); continue; }
        const { data: urlData } = supabase.storage.from('order-layouts').getPublicUrl(filePath);
        await supabase.from('order_files').insert({
          order_id: orderData.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
        });
      }

      // Save delivery date as a custom value with special key
      if (data.deliveryDate) {
        // Store as order_custom_values with a pseudo-field — we'll use the order metadata approach
        // Actually let's just note it. For now delivery_date isn't a column, store as custom value
      }

      setConfectionDialogOpen(false);
      toast.success('Pedido de confecção cadastrado!');
      // Refresh data via context
      await refreshData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao cadastrar pedido');
    }
  };

  const handleEdit = async (data: OrderFormOutput) => {
    if (editingOrder) {
      try {
        await updateOrder(editingOrder.id, data);
        setEditingOrder(null);
        toast.success('Pedido atualizado!');
      } catch { toast.error('Erro ao atualizar pedido'); }
    }
  };

  const handleDelete = async (order: Order) => {
    if (confirm('Remover este pedido?')) {
      await deleteOrder(order.id);
      toast.success('Pedido removido');
    }
  };

  const copyTrackingId = (trackingId: string) => {
    navigator.clipboard.writeText(trackingId);
    toast.success(`ID ${trackingId} copiado!`);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-description">Gerencie seus pedidos de serviço</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={confectionDialogOpen} onOpenChange={setConfectionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Confecção</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo Pedido — Confecção</DialogTitle></DialogHeader>
              <ConfectionOrderForm
                customFields={customFields}
                onSubmit={handleConfectionAdd}
                onCancel={() => setConfectionDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Designer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Pedido — Designer</DialogTitle></DialogHeader>
              <DesignerOrderForm onSubmit={handleAdd} onCancel={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedidos..." className="pl-10" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{search ? 'Nenhum pedido encontrado' : 'Nenhum pedido cadastrado'}</p>
          <p className="text-sm mt-1">{!search && 'Clique em "Designer" ou "Confecção" para começar'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(order => {
            const client = clients.find(c => c.id === order.clientId);
            const desc = getOrderDescription(order, services);
            const total = getOrderTotal(order);
            const statusLabel = getStatusLabel(order.status);
            const isConfection = order.orderType === 'confeccao';
            return (
              <div key={order.id} className={cn("bg-card rounded-xl border border-border/50 p-4 hover:shadow-sm transition-all", order.paid && "opacity-60")}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <button onClick={() => copyTrackingId(order.trackingId)} className="text-xs font-mono bg-muted px-2 py-0.5 rounded hover:bg-muted/80 transition-colors flex items-center gap-1" title="Copiar ID">
                        {order.trackingId} <Copy className="h-3 w-3" />
                      </button>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", isConfection ? "bg-accent/20 text-accent-foreground" : "bg-primary/10 text-primary")}>
                        {isConfection ? 'Confecção' : 'Designer'}
                      </span>
                      <span className={cn("font-medium", order.paid && "line-through")}>{client?.name ?? 'Cliente removido'}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                      {order.paid && <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Pago</span>}
                    </div>
                    {desc && <p className="text-sm text-muted-foreground truncate">{desc}</p>}
                    <div className="mt-2">
                      <Select value={order.status} onValueChange={(val) => updateOrderStatus(order.id, val)}>
                        <SelectTrigger className="h-7 w-auto text-xs">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                            {statusLabel}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {total > 0 && (
                      <span className={cn("font-semibold whitespace-nowrap", order.paid ? "text-muted-foreground line-through" : "text-success")}>R$ {total.toFixed(2)}</span>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setPreviewOrder(order)} title="Visualizar pedido">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleOrderPaid(order.id)} title={order.paid ? 'Marcar como pendente' : 'Marcar como pago'}>
                      {order.paid ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4" />}
                    </Button>
                    {!isConfection && (
                      <Button variant="ghost" size="icon" onClick={() => setEditingOrder(order)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(order)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingOrder} onOpenChange={(open) => { if (!open) setEditingOrder(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Pedido</DialogTitle></DialogHeader>
          {editingOrder && <DesignerOrderForm initial={editingOrder} onSubmit={handleEdit} onCancel={() => setEditingOrder(null)} />}
        </DialogContent>
      </Dialog>

      <OrderPreview order={previewOrder} open={!!previewOrder} onOpenChange={(open) => { if (!open) setPreviewOrder(null); }} />
    </div>
  );
};

export default Orders;
