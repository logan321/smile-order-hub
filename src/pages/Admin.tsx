import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, AlertTriangle, CheckCircle, Ban, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Subscriber {
  user_id: string;
  email: string;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  blocked: boolean;
}

const Admin = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const fetchSubscribers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-subscribers');
      if (error) throw error;
      setSubscribers(data?.subscribers || []);
    } catch (err) {
      console.error('Error fetching subscribers:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    setToggling(userId);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ blocked: !currentlyBlocked })
        .eq('user_id', userId);
      if (error) throw error;
      setSubscribers(prev =>
        prev.map(s => s.user_id === userId ? { ...s, blocked: !currentlyBlocked } : s)
      );
      toast.success(currentlyBlocked ? 'Usuário desbloqueado' : 'Usuário bloqueado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar');
    } finally {
      setToggling(null);
    }
  };

  const activeCount = subscribers.filter(s => !s.blocked && (s.status === 'active' || (s.status === 'trialing' && s.trial_ends_at && new Date(s.trial_ends_at) > new Date()))).length;
  const trialCount = subscribers.filter(s => s.status === 'trialing').length;
  const blockedCount = subscribers.filter(s => s.blocked).length;
  const expiredCount = subscribers.filter(s => !s.blocked && (['canceled', 'past_due'].includes(s.status) || (s.status === 'trialing' && s.trial_ends_at && new Date(s.trial_ends_at) <= new Date()))).length;

  const statusBadge = (sub: Subscriber) => {
    if (sub.blocked) return <Badge variant="destructive">Bloqueado</Badge>;
    if (sub.status === 'active') return <Badge className="bg-success text-success-foreground">Ativo</Badge>;
    if (sub.status === 'trialing') {
      const expired = sub.trial_ends_at && new Date(sub.trial_ends_at) <= new Date();
      return expired
        ? <Badge variant="destructive">Trial expirado</Badge>
        : <Badge className="bg-warning text-warning-foreground">Em teste</Badge>;
    }
    if (sub.status === 'past_due') return <Badge variant="destructive">Pagamento pendente</Badge>;
    if (sub.status === 'canceled') return <Badge variant="secondary">Cancelado</Badge>;
    return <Badge variant="secondary">{sub.status}</Badge>;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Painel Administrativo</h1>
        <p className="page-description">Gerencie os assinantes da plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="stat-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Ativos</p>
            </div>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trialCount}</p>
              <p className="text-sm text-muted-foreground">Em teste</p>
            </div>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Ban className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{blockedCount}</p>
              <p className="text-sm text-muted-foreground">Bloqueados</p>
            </div>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{expiredCount}</p>
              <p className="text-sm text-muted-foreground">Inativos</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assinantes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : subscribers.length === 0 ? (
            <p className="text-muted-foreground">Nenhum assinante encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">E-mail</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Cadastro</th>
                    <th className="text-left py-3 px-2 font-medium">Vencimento</th>
                    <th className="text-left py-3 px-2 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.user_id} className="border-b last:border-0">
                      <td className="py-3 px-2">{sub.email}</td>
                      <td className="py-3 px-2">{statusBadge(sub)}</td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {format(new Date(sub.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {sub.current_period_end
                          ? format(new Date(sub.current_period_end), 'dd/MM/yyyy', { locale: ptBR })
                          : sub.trial_ends_at
                            ? format(new Date(sub.trial_ends_at), 'dd/MM/yyyy', { locale: ptBR })
                            : '—'}
                      </td>
                      <td className="py-3 px-2">
                        <Button
                          size="sm"
                          variant={sub.blocked ? 'default' : 'destructive'}
                          disabled={toggling === sub.user_id}
                          onClick={() => toggleBlock(sub.user_id, sub.blocked)}
                        >
                          {sub.blocked ? (
                            <><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Liberar</>
                          ) : (
                            <><Ban className="h-3.5 w-3.5 mr-1" /> Bloquear</>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;