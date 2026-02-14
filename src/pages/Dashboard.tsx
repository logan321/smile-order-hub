import { useApp } from '@/context/AppContext';
import { Users, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Dashboard = () => {
  const { clients, orders } = useApp();

  const totalRevenue = orders.reduce((sum, o) => sum + o.price, 0);
  const pendingRevenue = orders.filter(o => !o.paid).reduce((sum, o) => sum + o.price, 0);
  const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const stats = [
    { label: 'Clientes', value: clients.length, icon: Users, color: 'text-primary' },
    { label: 'Pedidos', value: orders.length, icon: ShoppingCart, color: 'text-accent' },
    { label: 'Receita Total', value: `R$ ${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-success' },
    { label: 'Pendente', value: `R$ ${pendingRevenue.toFixed(2)}`, icon: TrendingUp, color: 'text-accent' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold font-display">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm">
        <div className="p-5 border-b border-border/50">
          <h2 className="text-lg font-semibold font-display">Pedidos Recentes</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum pedido cadastrado ainda</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {recentOrders.map((order) => {
              const client = clients.find(c => c.id === order.clientId);
              return (
                <div key={order.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-medium">{client?.name ?? 'Cliente removido'}</p>
                    <p className="text-sm text-muted-foreground">{order.service}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-success">R$ {order.price.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(order.date), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
