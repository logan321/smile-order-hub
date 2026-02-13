import { useApp } from '@/context/AppContext';
import { ClientReport } from '@/types';
import { FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { loadBusinessConfig } from '@/lib/businessConfig';
import { generateClientReportPDF } from '@/lib/generatePDF';
import { toast } from 'sonner';

const Reports = () => {
  const { clients, orders } = useApp();
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const reports: ClientReport[] = clients.map(client => {
    const clientOrders = orders.filter(o => o.clientId === client.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { client, orders: clientOrders, total: clientOrders.reduce((sum, o) => sum + o.price, 0) };
  }).sort((a, b) => b.total - a.total);

  const grandTotal = reports.reduce((sum, r) => sum + r.total, 0);

  const handleExportPDF = (report: ClientReport) => {
    const config = loadBusinessConfig();
    if (!config.businessName && !config.ownerName) {
      toast.warning('Configure seus dados em Configurações antes de gerar o PDF');
      return;
    }
    generateClientReportPDF(report.client, report.orders, report.total, config);
    toast.success(`PDF gerado para ${report.client.name}`);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <p className="page-description">Resumo financeiro por cliente</p>
      </div>

      {grandTotal > 0 && (
        <div className="stat-card mb-6">
          <p className="text-sm text-muted-foreground">Receita Total</p>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExportPDF(report)}
                      title="Exportar PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && clientOrders.length > 0 && (
                  <div className="border-t border-border/50 divide-y divide-border/30 bg-muted/20">
                    {clientOrders.map(order => (
                      <div key={order.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{order.service}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}</p>
                        </div>
                        <span className="text-sm font-semibold">R$ {order.price.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="px-4 py-3 flex items-center justify-between bg-muted/40">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="font-bold text-success">R$ {total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Reports;
