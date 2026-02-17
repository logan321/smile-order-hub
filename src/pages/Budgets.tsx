import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { Service } from '@/types';
import { Plus, Trash2, FileText, Send, Eye, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { loadBusinessConfig } from '@/lib/businessConfig';
import { generateBudgetPDF, BudgetPDFData } from '@/lib/generateBudgetPDF';

interface BudgetItem {
  serviceId: string;
  quantity: number;
  unitPrice: number;
}

interface Budget {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  notes: string;
  items: BudgetItem[];
  createdAt: string;
}

const Budgets = () => {
  const { services } = useApp();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewBudget, setViewBudget] = useState<Budget | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<BudgetItem[]>([{ serviceId: '', quantity: 1, unitPrice: 0 }]);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    const { data: budgetsData } = await supabase
      .from('budgets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!budgetsData || budgetsData.length === 0) {
      setBudgets([]);
      setLoading(false);
      return;
    }

    const budgetIds = budgetsData.map(b => b.id);
    const { data: allItems } = await supabase
      .from('budget_items')
      .select('*')
      .in('budget_id', budgetIds);

    const itemsMap: Record<string, BudgetItem[]> = {};
    (allItems ?? []).forEach((item: any) => {
      if (!itemsMap[item.budget_id]) itemsMap[item.budget_id] = [];
      itemsMap[item.budget_id].push({
        serviceId: item.service_id,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
      });
    });

    setBudgets(budgetsData.map((b: any) => ({
      id: b.id,
      clientName: b.client_name,
      clientPhone: b.client_phone,
      clientEmail: b.client_email,
      notes: b.notes,
      items: itemsMap[b.id] ?? [],
      createdAt: b.created_at,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const resetForm = () => {
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setNotes('');
    setItems([{ serviceId: '', quantity: 1, unitPrice: 0 }]);
  };

  const addItem = () => setItems([...items, { serviceId: '', quantity: 1, unitPrice: 0 }]);

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof BudgetItem, value: any) => {
    const updated = [...items];
    if (field === 'serviceId') {
      const svc = services.find(s => s.id === value);
      updated[idx] = { ...updated[idx], serviceId: value, unitPrice: svc?.price ?? 0 };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setItems(updated);
  };

  const getTotal = (budgetItems: BudgetItem[]) =>
    budgetItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const handleCreate = async () => {
    if (!clientName.trim()) { toast.error('Informe o nome do cliente'); return; }
    const validItems = items.filter(i => i.serviceId);
    if (validItems.length === 0) { toast.error('Adicione pelo menos um serviço'); return; }

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) throw new Error('Não autenticado');

      const { data: budgetData, error } = await supabase
        .from('budgets')
        .insert({
          user_id: userId,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          client_email: clientEmail.trim(),
          notes: notes.trim(),
        })
        .select('id')
        .single();

      if (error) throw error;

      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(validItems.map(item => ({
          budget_id: budgetData.id,
          service_id: item.serviceId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })));

      if (itemsError) throw itemsError;

      toast.success('Orçamento criado!');
      setDialogOpen(false);
      resetForm();
      fetchBudgets();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar orçamento');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este orçamento?')) return;
    await supabase.from('budgets').delete().eq('id', id);
    toast.success('Orçamento removido');
    fetchBudgets();
  };

  const handlePDF = (budget: Budget) => {
    const config = loadBusinessConfig();
    const data: BudgetPDFData = {
      clientName: budget.clientName,
      clientPhone: budget.clientPhone,
      clientEmail: budget.clientEmail,
      notes: budget.notes,
      items: budget.items,
      createdAt: budget.createdAt,
    };
    generateBudgetPDF(data, services, config);
  };

  const handleWhatsApp = (budget: Budget) => {
    const total = getTotal(budget.items);
    const itemsText = budget.items.map(item => {
      const svc = services.find(s => s.id === item.serviceId);
      const name = svc?.name ?? 'Serviço';
      return `• ${name} (x${item.quantity}) — R$ ${(item.unitPrice * item.quantity).toFixed(2)}`;
    }).join('\n');

    const config = loadBusinessConfig();
    const message = [
      `*ORÇAMENTO${config.businessName ? ` — ${config.businessName}` : ''}*`,
      '',
      `*Cliente:* ${budget.clientName}`,
      '',
      '*Serviços:*',
      itemsText,
      '',
      `*Total: R$ ${total.toFixed(2)}*`,
      ...(budget.notes ? ['\n*Obs:* ' + budget.notes] : []),
    ].join('\n');

    const phone = budget.clientPhone.replace(/\D/g, '');
    const url = `https://wa.me/${phone ? phone : ''}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filtered = budgets.filter(b =>
    b.clientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Orçamentos</h1>
          <p className="page-description">Crie e envie orçamentos para seus clientes</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Novo Orçamento
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente..." className="pl-10" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{search ? 'Nenhum orçamento encontrado' : 'Nenhum orçamento criado'}</p>
          <p className="text-sm mt-1">{!search && 'Clique em "Novo Orçamento" para começar'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(budget => {
            const total = getTotal(budget.items);
            return (
              <div key={budget.id} className="bg-card rounded-xl border border-border/50 p-4 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{budget.clientName}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {budget.items.length} {budget.items.length === 1 ? 'serviço' : 'serviços'} • {format(new Date(budget.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <span className="font-semibold whitespace-nowrap text-success mr-2">R$ {total.toFixed(2)}</span>
                    <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setViewBudget(budget)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Gerar PDF" onClick={() => handlePDF(budget)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Enviar WhatsApp" onClick={() => handleWhatsApp(budget)}>
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Remover" onClick={() => handleDelete(budget.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nome do Cliente / Empresa *</label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Telefone</label>
                <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">E-mail</label>
                <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Serviços *</label>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={item.serviceId} onValueChange={v => updateItem(idx, 'serviceId', v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} — R$ {s.price.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-20"
                      placeholder="Qtd"
                    />
                    <span className="text-sm font-medium whitespace-nowrap w-24 text-right">
                      R$ {(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="shrink-0">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addItem} className="mt-2">
                <Plus className="h-3 w-3 mr-1" />Adicionar serviço
              </Button>
            </div>

            <div className="flex justify-end text-lg font-bold">
              Total: R$ {getTotal(items.filter(i => i.serviceId)).toFixed(2)}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Observações</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Informações adicionais..." rows={3} />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar Orçamento</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewBudget} onOpenChange={open => { if (!open) setViewBudget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do Orçamento</DialogTitle></DialogHeader>
          {viewBudget && (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-lg">{viewBudget.clientName}</p>
                {viewBudget.clientPhone && <p className="text-sm text-muted-foreground">{viewBudget.clientPhone}</p>}
                {viewBudget.clientEmail && <p className="text-sm text-muted-foreground">{viewBudget.clientEmail}</p>}
                <p className="text-sm text-muted-foreground">{format(new Date(viewBudget.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
              <div className="border-t pt-3 space-y-2">
                {viewBudget.items.map((item, i) => {
                  const svc = services.find(s => s.id === item.serviceId);
                  return (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{svc?.name ?? 'Serviço removido'} (x{item.quantity})</span>
                      <span className="font-medium">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>R$ {getTotal(viewBudget.items).toFixed(2)}</span>
                </div>
              </div>
              {viewBudget.notes && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium">Observações:</p>
                  <p className="text-sm text-muted-foreground">{viewBudget.notes}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => handlePDF(viewBudget)}>
                  <FileText className="h-4 w-4 mr-2" />PDF
                </Button>
                <Button onClick={() => handleWhatsApp(viewBudget)}>
                  <Send className="h-4 w-4 mr-2" />WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Budgets;
