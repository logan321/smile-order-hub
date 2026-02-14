import { useState } from 'react';
import { useApp, getOrderTotal, getOrderDescription } from '@/context/AppContext';
import { Order, OrderItem } from '@/types';
import { Plus, Pencil, Trash2, ShoppingCart, Search, X, CheckCircle2, Circle, Minus, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const STATUS_OPTIONS = [
  { value: 'received', label: 'Recebido' },
  { value: 'in_production', label: 'Em Produção' },
  { value: 'ready', label: 'Pronto' },
  { value: 'delivered', label: 'Entregue' },
];

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-muted text-muted-foreground',
  in_production: 'bg-accent/20 text-accent-foreground',
  ready: 'bg-success/20 text-success',
  delivered: 'bg-primary/20 text-primary',
};

interface OrderFormOutput { clientId: string; items: OrderItem[]; date: string; paid: boolean; }

const OrderForm = ({ initial, onSubmit, onCancel }: { initial?: Order; onSubmit: (data: OrderFormOutput) => void; onCancel: () => void }) => {
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
            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
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

const Orders = () => {
  const { clients, orders, services, addOrder, updateOrder, deleteOrder, toggleOrderPaid, updateOrderStatus } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Pedido</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Pedido</DialogTitle></DialogHeader>
            <OrderForm onSubmit={handleAdd} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
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
          <p className="text-sm mt-1">{!search && 'Clique em "Novo Pedido" para começar'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(order => {
            const client = clients.find(c => c.id === order.clientId);
            const desc = getOrderDescription(order, services);
            const total = getOrderTotal(order);
            const statusLabel = STATUS_OPTIONS.find(s => s.value === order.status)?.label ?? order.status;
            return (
              <div key={order.id} className={cn("bg-card rounded-xl border border-border/50 p-4 hover:shadow-sm transition-all", order.paid && "opacity-60")}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <button onClick={() => copyTrackingId(order.trackingId)} className="text-xs font-mono bg-muted px-2 py-0.5 rounded hover:bg-muted/80 transition-colors flex items-center gap-1" title="Copiar ID">
                        {order.trackingId} <Copy className="h-3 w-3" />
                      </button>
                      <span className={cn("font-medium", order.paid && "line-through")}>{client?.name ?? 'Cliente removido'}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                      {order.paid && <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Pago</span>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{desc}</p>
                    <div className="mt-2">
                      <Select value={order.status} onValueChange={(val) => updateOrderStatus(order.id, val)}>
                        <SelectTrigger className="h-7 w-auto text-xs">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[order.status] ?? '')}>
                            {statusLabel}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className={cn("font-semibold whitespace-nowrap", order.paid ? "text-muted-foreground line-through" : "text-success")}>R$ {total.toFixed(2)}</span>
                    <Button variant="ghost" size="icon" onClick={() => toggleOrderPaid(order.id)} title={order.paid ? 'Marcar como pendente' : 'Marcar como pago'}>
                      {order.paid ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingOrder(order)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
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
          {editingOrder && <OrderForm initial={editingOrder} onSubmit={handleEdit} onCancel={() => setEditingOrder(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
