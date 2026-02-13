import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Client } from '@/types';
import { Plus, Pencil, Trash2, Users, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

const ClientForm = ({ initial, onSubmit, onCancel }: { initial?: Client; onSubmit: (data: { name: string; phone: string; email: string }) => void; onCancel: () => void }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Nome *</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do cliente" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Telefone</label>
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">E-mail</label>
        <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{initial ? 'Salvar' : 'Cadastrar'}</Button>
      </div>
    </form>
  );
};

const Clients = () => {
  const { clients, addClient, updateClient, deleteClient } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (data: { name: string; phone: string; email: string }) => {
    addClient(data);
    setDialogOpen(false);
    toast.success('Cliente cadastrado!');
  };

  const handleEdit = (data: { name: string; phone: string; email: string }) => {
    if (editingClient) {
      updateClient(editingClient.id, data);
      setEditingClient(null);
      toast.success('Cliente atualizado!');
    }
  };

  const handleDelete = (client: Client) => {
    if (confirm(`Remover ${client.name}? Os pedidos deste cliente também serão removidos.`)) {
      deleteClient(client.id);
      toast.success('Cliente removido');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-description">Gerencie sua base de clientes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
            <ClientForm onSubmit={handleAdd} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar clientes..." className="pl-10" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p>
          <p className="text-sm mt-1">{!search && 'Clique em "Novo Cliente" para começar'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(client => (
            <div key={client.id} className="bg-card rounded-xl border border-border/50 p-4 flex items-center justify-between hover:shadow-sm transition-all">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">{client.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm text-muted-foreground">{client.email || client.phone || 'Sem contato'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditingClient(client)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(client)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editingClient} onOpenChange={(open) => { if (!open) setEditingClient(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          {editingClient && <ClientForm initial={editingClient} onSubmit={handleEdit} onCancel={() => setEditingClient(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
