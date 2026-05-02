import { useApp, getOrderTotal, getOrderDescription } from '@/context/AppContext';
import { ClientReport, Order } from '@/types';
import { FileText, ChevronDown, ChevronUp, Download, CalendarDays, CheckCheck, Trash2, CalendarIcon } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { loadBusinessConfig } from '@/lib/businessConfig';
import { generateClientReportPDF } from '@/lib/generatePDF';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const Reports = () => {
  const { clients, orders, services, toggleOrderPaid, deleteOrder } = useApp();
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [exportDialogClient, setExportDialogClient] = useState<ClientReport | null>(null);
  const [exportPeriod, setExportPeriod] = useState<'all' | 'daily' | 'range'>('all');
  const [exportDay, setExportDay] = useState<Date | undefined>(new Date());
  const [exportFrom, setExportFrom] = useState<Date | undefined>(undefined);
  const [exportTo, setExportTo] = useState<Date | undefined>(undefined);
  const [exportOnlyUnpaid, setExportOnlyUnpaid] = useState(true);

  // ─── Monthly report state ───
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach(o => {
      const d = new Date(o.date);
      months.add(format(d, 'yyyy-MM'));
    });
    // Add current month even if no orders
    months.add(format(new Date(), 'yyyy-MM'));
    return Array.from(months).sort().reverse();
  }, [orders]);

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] ?? format(new Date(), 'yyyy-MM'));

  const monthOrders = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const target = new Date(year, month - 1, 1);
    return orders.filter(o => isSameMonth(new Date(o.date), target));
  }, [orders, selectedMonth]);

  const designerOrders = monthOrders.filter(o => o.orderType !== 'confeccao');
  const confectionOrders = monthOrders.filter(o => o.orderType === 'confeccao');

  const monthTotalReceived = monthOrders.filter(o => o.paid).reduce((s, o) => s + getOrderTotal(o), 0);
  const monthTotalPending = monthOrders.filter(o => !o.paid).reduce((s, o) => s + getOrderTotal(o), 0);
  const monthTotal = monthOrders.reduce((s, o) => s + getOrderTotal(o), 0);

  // ─── Client reports (existing) ───
  const reports: ClientReport[] = clients.map(client => {
    const clientOrders = orders.filter(o => o.clientId === client.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const unpaidOrders = clientOrders.filter(o => !o.paid);
    return { client, orders: clientOrders, total: unpaidOrders.reduce((sum, o) => sum + getOrderTotal(o), 0) };
  }).sort((a, b) => b.total - a.total);

  const grandTotal = reports.reduce((sum, r) => sum + r.total, 0);

  const openExportDialog = (report: ClientReport) => {
    setExportDialogClient(report);
    setExportPeriod('all');
    setExportDay(new Date());
    setExportFrom(undefined);
    setExportTo(undefined);
    setExportOnlyUnpaid(true);
  };

  const handleConfirmExport = () => {
    if (!exportDialogClient) return;
    const config = loadBusinessConfig();
    if (!config.businessName && !config.ownerName) {
      toast.warning('Configure seus dados em Configurações antes de gerar o PDF');
      return;
    }

    let filtered = exportDialogClient.orders;

    if (exportPeriod === 'daily') {
      if (!exportDay) { toast.warning('Selecione um dia'); return; }
      filtered = filtered.filter(o => isSameDay(new Date(o.date), exportDay));
    } else if (exportPeriod === 'range') {
      if (!exportFrom || !exportTo) { toast.warning('Selecione as datas inicial e final'); return; }
      const from = startOfDay(exportFrom).getTime();
      const to = endOfDay(exportTo).getTime();
      filtered = filtered.filter(o => {
        const t = new Date(o.date).getTime();
        return t >= from && t <= to;
      });
    }

    if (exportOnlyUnpaid) filtered = filtered.filter(o => !o.paid);

    if (filtered.length === 0) {
      toast.warning('Nenhum pedido no período selecionado');
      return;
    }

    const total = filtered.reduce((s, o) => s + getOrderTotal(o), 0);
    generateClientReportPDF(exportDialogClient.client, filtered, total, config, services);
    toast.success(`PDF gerado para ${exportDialogClient.client.name}`);
    setExportDialogClient(null);
  };

  const handleMarkAllPaid = async (clientOrders: Order[]) => {
    const unpaid = clientOrders.filter(o => !o.paid);
    if (unpaid.length === 0) {
      toast.info('Nenhum pedido pendente');
      return;
    }
    await Promise.all(unpaid.map(o => toggleOrderPaid(o.id)));
    toast.success(`${unpaid.length} pedido${unpaid.length !== 1 ? 's' : ''} marcado${unpaid.length !== 1 ? 's' : ''} como pago${unpaid.length !== 1 ? 's' : ''}`);
  };

  const handleDeleteAll = async (clientOrders: Order[]) => {
    if (clientOrders.length === 0) return;
    await Promise.all(clientOrders.map(o => deleteOrder(o.id)));
    toast.success(`${clientOrders.length} pedido${clientOrders.length !== 1 ? 's' : ''} removido${clientOrders.length !== 1 ? 's' : ''}`);
  };

  const formatMonthLabel = (m: string) => {
    const [year, month] = m.split('-').map(Number);
    return format(new Date(year, month - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
  };

  const renderOrderRow = (order: typeof orders[0]) => {
    const client = clients.find(c => c.id === order.clientId);
    const desc = getOrderDescription(order, services);
    const total = getOrderTotal(order);
    return (
      <div key={order.id} className={`px-4 py-3 flex items-center justify-between ${order.paid ? 'opacity-50' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{order.trackingId}</span>
            <span className="text-sm font-medium">{client?.name ?? 'Removido'}</span>
          </div>
          {order.name && <p className="text-sm text-foreground mt-0.5">{order.name}</p>}
          {desc && <p className="text-xs text-muted-foreground truncate">{desc}</p>}
          <p className="text-xs text-muted-foreground">{format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}</p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {order.paid && <span className="text-xs text-success font-semibold">Pago</span>}
          <span className={`text-sm font-semibold ${order.paid ? 'line-through text-muted-foreground' : ''}`}>
            {total > 0 ? `R$ ${total.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <p className="page-description">Controle financeiro profissional</p>
      </div>

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly"><CalendarDays className="h-4 w-4 mr-1.5" />Mensal</TabsTrigger>
          <TabsTrigger value="clients"><FileText className="h-4 w-4 mr-1.5" />Por Cliente</TabsTrigger>
        </TabsList>

        {/* ═══ MONTHLY REPORT ═══ */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m} className="capitalize">{formatMonthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="stat-card">
              <p className="text-xs text-muted-foreground">Total do Mês</p>
              <p className="text-2xl font-bold font-display">R$ {monthTotal.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{monthOrders.length} pedido{monthOrders.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-2xl font-bold font-display text-success">R$ {monthTotalReceived.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{monthOrders.filter(o => o.paid).length} pago{monthOrders.filter(o => o.paid).length !== 1 ? 's' : ''}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-2xl font-bold font-display text-destructive">R$ {monthTotalPending.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{monthOrders.filter(o => !o.paid).length} pendente{monthOrders.filter(o => !o.paid).length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Designer section */}
          {designerOrders.length > 0 && (
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">Designer</span>
                  <span className="text-sm font-semibold">{designerOrders.length} pedido{designerOrders.length !== 1 ? 's' : ''}</span>
                </div>
                <span className="font-bold text-success">R$ {designerOrders.reduce((s, o) => s + getOrderTotal(o), 0).toFixed(2)}</span>
              </div>
              <div className="divide-y divide-border/30">
                {designerOrders.map(renderOrderRow)}
              </div>
            </div>
          )}

          {/* Confection section */}
          {confectionOrders.length > 0 && (
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-accent/20 text-accent-foreground">Confecção</span>
                  <span className="text-sm font-semibold">{confectionOrders.length} pedido{confectionOrders.length !== 1 ? 's' : ''}</span>
                </div>
                <span className="font-bold text-success">R$ {confectionOrders.reduce((s, o) => s + getOrderTotal(o), 0).toFixed(2)}</span>
              </div>
              <div className="divide-y divide-border/30">
                {confectionOrders.map(renderOrderRow)}
              </div>
            </div>
          )}

          {monthOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum pedido neste mês</p>
            </div>
          )}
        </TabsContent>

        {/* ═══ CLIENT REPORT (existing) ═══ */}
        <TabsContent value="clients" className="space-y-4">
          {grandTotal > 0 && (
            <div className="stat-card">
              <p className="text-sm text-muted-foreground">Total Pendente</p>
              <p className="text-3xl font-bold font-display text-success">R$ {grandTotal.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground mt-1">{orders.length} pedido{orders.length !== 1 ? 's' : ''} de {clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
            </div>
          )}

          {reports.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum dado para exibir</p>
              <p className="text-sm mt-1">Cadastre clientes e pedidos para gerar relatórios</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {reports.map(({ client, orders: clientOrders, total }) => {
                const isExpanded = expandedClient === client.id;
                const report = { client, orders: clientOrders, total };
                return (
                  <div key={client.id} className="bg-card rounded-xl border border-border/50 overflow-hidden transition-all">
                    <div className="flex items-center">
                      <button
                        onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                        className="flex-1 p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-semibold text-primary">{client.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-sm text-muted-foreground">{clientOrders.length} pedido{clientOrders.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-success">R$ {total.toFixed(2)}</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      <div className="pr-3">
                        <Button variant="ghost" size="icon" onClick={() => openExportDialog(report)} title="Exportar PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && clientOrders.length > 0 && (
                      <div className="border-t border-border/50 divide-y divide-border/30 bg-muted/20">
                        {clientOrders.map(order => {
                          const desc = getOrderDescription(order, services);
                          const orderTotal = getOrderTotal(order);
                          return (
                            <div key={order.id} className={`px-4 py-3 flex items-center justify-between gap-2 ${order.paid ? 'opacity-50' : ''}`}>
                              <div className="flex-1 min-w-0">
                                {order.name && <p className="text-sm font-medium">{order.name}</p>}
                                <p className={`text-sm ${order.name ? 'text-muted-foreground' : 'font-medium'} ${order.paid ? 'line-through' : ''}`}>{desc || (order.orderType === 'confeccao' ? 'Confecção' : 'Pedido')}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {order.paid && <span className="text-xs text-success font-semibold">Pago</span>}
                                <span className={`text-sm font-semibold ${order.paid ? 'line-through text-muted-foreground' : ''}`}>
                                  {orderTotal > 0 ? `R$ ${orderTotal.toFixed(2)}` : '—'}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => toggleOrderPaid(order.id)}
                                  title={order.paid ? 'Marcar como pendente' : 'Marcar como pago'}
                                >
                                  <CheckCheck className={`h-4 w-4 ${order.paid ? 'text-success' : ''}`} />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Apagar pedido">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Apagar este pedido?</AlertDialogTitle>
                                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteOrder(order.id)}>Apagar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          );
                        })}
                        <div className="px-4 py-3 flex items-center justify-between gap-3 bg-muted/40 flex-wrap">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold">Total Pendente</span>
                            <span className="font-bold text-success">R$ {total.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAllPaid(clientOrders)}
                              disabled={clientOrders.every(o => o.paid)}
                            >
                              <CheckCheck className="h-4 w-4 mr-1.5" />
                              Marcar todos como pagos
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4 mr-1.5" />
                                  Apagar todos
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Apagar todos os pedidos de {client.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Isso vai remover {clientOrders.length} pedido{clientOrders.length !== 1 ? 's' : ''} permanentemente. Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteAll(clientOrders)}>Apagar tudo</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ EXPORT PDF DIALOG ═══ */}
      <Dialog open={!!exportDialogClient} onOpenChange={(open) => !open && setExportDialogClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Relatório PDF</DialogTitle>
            <DialogDescription>
              {exportDialogClient?.client.name} — escolha o período
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <RadioGroup value={exportPeriod} onValueChange={(v) => setExportPeriod(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="p-all" />
                <Label htmlFor="p-all" className="cursor-pointer">Todo o período</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="p-daily" />
                <Label htmlFor="p-daily" className="cursor-pointer">Dia específico</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="range" id="p-range" />
                <Label htmlFor="p-range" className="cursor-pointer">Intervalo de datas</Label>
              </div>
            </RadioGroup>

            {exportPeriod === 'daily' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !exportDay && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportDay ? format(exportDay, "dd/MM/yyyy", { locale: ptBR }) : 'Escolha o dia'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={exportDay} onSelect={setExportDay} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                </PopoverContent>
              </Popover>
            )}

            {exportPeriod === 'range' && (
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !exportFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {exportFrom ? format(exportFrom, "dd/MM/yy", { locale: ptBR }) : 'De'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={exportFrom} onSelect={setExportFrom} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal", !exportTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {exportTo ? format(exportTo, "dd/MM/yy", { locale: ptBR }) : 'Até'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={exportTo} onSelect={setExportTo} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="flex items-center space-x-2 pt-2 border-t border-border/50">
              <input
                type="checkbox"
                id="only-unpaid"
                checked={exportOnlyUnpaid}
                onChange={(e) => setExportOnlyUnpaid(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="only-unpaid" className="cursor-pointer text-sm">Apenas pendentes (não pagos)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogClient(null)}>Cancelar</Button>
            <Button onClick={handleConfirmExport}>
              <Download className="h-4 w-4 mr-1.5" /> Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
