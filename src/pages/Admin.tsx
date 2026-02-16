import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Users, AlertTriangle, CheckCircle, Ban, ShieldCheck, MoreHorizontal, CalendarPlus, Clock, DollarSign, Shirt, ExternalLink } from 'lucide-react';
import { format, addDays, addMonths } from 'date-fns';
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
  editor_enabled: boolean;
}

type ModalAction = 'extend_trial' | 'add_months' | 'change_plan' | null;

const Admin = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Modal state
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [selectedUser, setSelectedUser] = useState<Subscriber | null>(null);
  const [daysToAdd, setDaysToAdd] = useState('7');
  const [monthsToAdd, setMonthsToAdd] = useState('1');
  const [newPlanValue, setNewPlanValue] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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

  const toggleEditor = async (userId: string, currentlyEnabled: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('admin-subscribers', {
        method: 'POST',
        body: { action: 'toggle_editor', target_user_id: userId, enabled: !currentlyEnabled },
      });
      if (error) throw error;
      setSubscribers(prev =>
        prev.map(s => s.user_id === userId ? { ...s, editor_enabled: !currentlyEnabled } : s)
      );
      toast.success(!currentlyEnabled ? 'Editor liberado' : 'Editor desativado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar editor');
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const currentEnd = selectedUser.trial_ends_at ? new Date(selectedUser.trial_ends_at) : new Date();
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      const newTrialEnd = addDays(baseDate, parseInt(daysToAdd));

      const { error } = await supabase
        .from('subscriptions')
        .update({
          trial_ends_at: newTrialEnd.toISOString(),
          status: 'trialing',
          blocked: false,
        })
        .eq('user_id', selectedUser.user_id);
      if (error) throw error;

      setSubscribers(prev =>
        prev.map(s => s.user_id === selectedUser.user_id
          ? { ...s, trial_ends_at: newTrialEnd.toISOString(), status: 'trialing', blocked: false }
          : s
        )
      );
      toast.success(`Trial estendido em ${daysToAdd} dias para ${selectedUser.email}`);
      setModalAction(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao estender trial');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMonths = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const currentEnd = selectedUser.current_period_end ? new Date(selectedUser.current_period_end) : new Date();
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      const newPeriodEnd = addMonths(baseDate, parseInt(monthsToAdd));

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
          blocked: false,
        })
        .eq('user_id', selectedUser.user_id);
      if (error) throw error;

      setSubscribers(prev =>
        prev.map(s => s.user_id === selectedUser.user_id
          ? { ...s, status: 'active', current_period_end: newPeriodEnd.toISOString(), blocked: false }
          : s
        )
      );
      toast.success(`${monthsToAdd} mês(es) adicionado(s) para ${selectedUser.email}`);
      setModalAction(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar meses');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedUser || !newPlanValue) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ plan: newPlanValue })
        .eq('user_id', selectedUser.user_id);
      if (error) throw error;

      setSubscribers(prev =>
        prev.map(s => s.user_id === selectedUser.user_id ? { ...s, plan: newPlanValue } : s)
      );
      toast.success(`Plano alterado para "${newPlanValue}" para ${selectedUser.email}`);
      setModalAction(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar plano');
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (action: ModalAction, user: Subscriber) => {
    setSelectedUser(user);
    setModalAction(action);
    setDaysToAdd('7');
    setMonthsToAdd('1');
    setNewPlanValue(user.plan || 'monthly');
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
                     <th className="text-left py-3 px-2 font-medium">Plano</th>
                     <th className="text-left py-3 px-2 font-medium">Editor</th>
                     <th className="text-left py-3 px-2 font-medium">Cadastro</th>
                     <th className="text-left py-3 px-2 font-medium">Vencimento</th>
                     <th className="text-left py-3 px-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.user_id} className="border-b last:border-0">
                      <td className="py-3 px-2">{sub.email}</td>
                      <td className="py-3 px-2">{statusBadge(sub)}</td>
                      <td className="py-3 px-2 text-muted-foreground capitalize">{sub.plan}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={sub.editor_enabled}
                            onCheckedChange={() => toggleEditor(sub.user_id, sub.editor_enabled)}
                          />
                          {sub.editor_enabled && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => window.open(`/editor/${sub.user_id}`, '_blank')}
                              title="Editar como este cliente"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openModal('extend_trial', sub)}>
                              <CalendarPlus className="h-4 w-4 mr-2" />
                              Adicionar dias (trial)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModal('add_months', sub)}>
                              <Clock className="h-4 w-4 mr-2" />
                              Adicionar meses (pago)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModal('change_plan', sub)}>
                              <DollarSign className="h-4 w-4 mr-2" />
                              Alterar plano
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleBlock(sub.user_id, sub.blocked)}
                              disabled={toggling === sub.user_id}
                              className={sub.blocked ? 'text-success' : 'text-destructive'}
                            >
                              {sub.blocked ? (
                                <><ShieldCheck className="h-4 w-4 mr-2" /> Desbloquear</>
                              ) : (
                                <><Ban className="h-4 w-4 mr-2" /> Bloquear</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extend Trial Modal */}
      <Dialog open={modalAction === 'extend_trial'} onOpenChange={() => setModalAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar dias ao trial</DialogTitle>
            <DialogDescription>
              Estender o período de teste de <strong>{selectedUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Dias para adicionar</label>
              <Select value={daysToAdd} onValueChange={setDaysToAdd}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedUser?.trial_ends_at && (
              <p className="text-sm text-muted-foreground">
                Trial atual vence em: {format(new Date(selectedUser.trial_ends_at), 'dd/MM/yyyy', { locale: ptBR })}
                <br />
                Novo vencimento: {format(
                  addDays(
                    new Date(selectedUser.trial_ends_at) > new Date() ? new Date(selectedUser.trial_ends_at) : new Date(),
                    parseInt(daysToAdd)
                  ),
                  'dd/MM/yyyy',
                  { locale: ptBR }
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>Cancelar</Button>
            <Button onClick={handleExtendTrial} disabled={actionLoading}>
              {actionLoading ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Months Modal */}
      <Dialog open={modalAction === 'add_months'} onOpenChange={() => setModalAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar meses pagos</DialogTitle>
            <DialogDescription>
              Liberar acesso pago para <strong>{selectedUser?.email}</strong> sem cobrar pelo Stripe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Meses para adicionar</label>
              <Select value={monthsToAdd} onValueChange={setMonthsToAdd}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mês</SelectItem>
                  <SelectItem value="2">2 meses</SelectItem>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              O status será alterado para <strong>ativo</strong> e o acesso será liberado até{' '}
              {format(addMonths(new Date(), parseInt(monthsToAdd)), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>Cancelar</Button>
            <Button onClick={handleAddMonths} disabled={actionLoading}>
              {actionLoading ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Modal */}
      <Dialog open={modalAction === 'change_plan'} onOpenChange={() => setModalAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar plano</DialogTitle>
            <DialogDescription>
              Alterar o plano de <strong>{selectedUser?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nome do plano</label>
              <Input
                value={newPlanValue}
                onChange={e => setNewPlanValue(e.target.value)}
                placeholder="Ex: monthly, yearly, premium"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Plano atual: <strong className="capitalize">{selectedUser?.plan}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAction(null)}>Cancelar</Button>
            <Button onClick={handleChangePlan} disabled={actionLoading || !newPlanValue}>
              {actionLoading ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;