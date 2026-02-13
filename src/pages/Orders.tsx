import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Order } from '@/types';
import { Plus, Pencil, Trash2, ShoppingCart, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface OrderFormData { clientId: string; service: string; price: number; date: string; }

const OrderForm = ({ initial, onSubmit, onCancel }: { initial?: Order; onSubmit: (data: OrderFormData) => void; onCancel: () => void }) => {
  const { clients } = useApp();
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [service, setService] = useState(initial?.service ?? '');
  const [price, setPrice] = useState(initial?.price?.toString() ?? '');
  const [date, setDate] = useState<Date | undefined>(initial ? new Date(initial.date) : new Date());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast.error('Selecione um cliente'); return; }
    if (!service.trim()) { toast.error('Descreva o serviço'); return; }
    if (!price || parseFloat(price) <= 0) { toast.error('Insira um preço válido'); return; }
    if (!date) { toast.error('Selecione a data'); return; }
    onSubmit({ clientId, service: service.trim(), price: parseFloat(price), date: date.toISOString() });
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
        <label className="text-sm font-medium mb-1.5 block">Serviço *</label>
        <Textarea value={service} onChange={e => setService(e.target.value)} placeholder="Descreva o serviço prestado" rows={3} />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Preço (R$) *</label>
        <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" type="number" step="0.01" min="0" />
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
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{initial ? 'Salvar' : 'Cadastrar'}</Button>
      </div>
    </form>
  );
};

const Orders = () => {
  const { clients, orders, addOrder, updateOrder, deleteOrder } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');

  const sorted = [...orders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const filtered = sorted.filter(o => {
    const client = clients.find(c => c.id === o.clientId);
    const term = search.toLowerCase();
    return o.service.toLowerCase().includes(term) || (client?.name.toLowerCase().includes(term) ?? false);
  });

  const handleAdd = (data: OrderFormData) => {
    addOrder(data);
    setDialogOpen(false);
    toast.success('Pedido cadastrado!');
  };

  const handleEdit = (data: OrderFormData) => {
    if (editingOrder) {
      updateOrder(editingOrder.id, data);
      setEditingOrder(null);
      toast.success('Pedido atualizado!');
    }
  };

  const handleDelete = (order: Order) => {
    if (confirm('Remover este pedido?')) {
      deleteOrder(order.id);
      toast.success('Pedido removido');
    }
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
            return (
              <div key={order.id} className="bg-card rounded-xl border border-border/50 p-4 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{client?.name ?? 'Cliente removido'}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{order.service}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="font-semibold text-success whitespace-nowrap">R$ {order.price.toFixed(2)}</span>
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
