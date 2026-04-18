import { useApp, getOrderTotal, getOrderDescription } from '@/context/AppContext';
import { ClientReport } from '@/types';
import { FileText, ChevronDown, ChevronUp, Download, CalendarDays, CheckCheck, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { loadBusinessConfig } from '@/lib/businessConfig';
import { generateClientReportPDF } from '@/lib/generatePDF';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Reports = () => {
  const { clients, orders, services } = useApp();
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

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

  const handleExportPDF = (report: ClientReport) => {
    const config = loadBusinessConfig();
    if (!config.businessName && !config.ownerName) {
      toast.warning('Configure seus dados em Configurações antes de gerar o PDF');
      return;
    }
    const unpaidOrders = report.orders.filter(o => !o.paid);
    generateClientReportPDF(report.client, unpaidOrders, report.total, config, services);
    toast.success(`PDF gerado para ${report.client.name}`);
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
                        <Button variant="ghost" size="icon" onClick={() => handleExportPDF(report)} title="Exportar PDF">
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
                            <div key={order.id} className={`px-4 py-3 flex items-center justify-between ${order.paid ? 'opacity-50' : ''}`}>
                              <div>
                                {order.name && <p className="text-sm font-medium">{order.name}</p>}
                                <p className={`text-sm ${order.name ? 'text-muted-foreground' : 'font-medium'} ${order.paid ? 'line-through' : ''}`}>{desc || (order.orderType === 'confeccao' ? 'Confecção' : 'Pedido')}</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {order.paid && <span className="text-xs text-success font-semibold">Pago</span>}
                                <span className={`text-sm font-semibold ${order.paid ? 'line-through text-muted-foreground' : ''}`}>
                                  {orderTotal > 0 ? `R$ ${orderTotal.toFixed(2)}` : '—'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        <div className="px-4 py-3 flex items-center justify-between bg-muted/40">
                          <span className="text-sm font-semibold">Total Pendente</span>
                          <span className="font-bold text-success">R$ {total.toFixed(2)}</span>
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
    </div>
  );
};

export default Reports;
