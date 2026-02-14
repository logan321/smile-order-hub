import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Service } from '@/types';
import { Plus, Pencil, Trash2, Wrench, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ServiceFormData { name: string; description: string; price: number; }

const ServiceForm = ({ initial, onSubmit, onCancel }: { initial?: Service; onSubmit: (data: ServiceFormData) => void; onCancel: () => void }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial?.price?.toString() ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Insira o nome do serviço'); return; }
    if (!price || parseFloat(price) <= 0) { toast.error('Insira um preço válido'); return; }
    onSubmit({ name: name.trim(), description: description.trim(), price: parseFloat(price) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Nome do Serviço *</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Diagramação de fechamento" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Descrição</label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição do serviço" rows={3} />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Preço (R$) *</label>
        <Input value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" type="number" step="0.01" min="0" />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{initial ? 'Salvar' : 'Cadastrar'}</Button>
      </div>
    </form>
  );
};

const Services = () => {
  const { services, addService, updateService, deleteService } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [search, setSearch] = useState('');

  const filtered = services.filter(s => {
    const term = search.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.description.toLowerCase().includes(term);
  });

  const handleAdd = async (data: ServiceFormData) => {
    try {
      await addService(data);
      setDialogOpen(false);
      toast.success('Serviço cadastrado!');
    } catch { toast.error('Erro ao cadastrar serviço'); }
  };

  const handleEdit = async (data: ServiceFormData) => {
    if (editingService) {
      try {
        await updateService(editingService.id, data);
        setEditingService(null);
        toast.success('Serviço atualizado!');
      } catch { toast.error('Erro ao atualizar serviço'); }
    }
  };

  const handleDelete = async (service: Service) => {
    if (confirm('Remover este serviço?')) {
      try {
        await deleteService(service.id);
        toast.success('Serviço removido');
      } catch { toast.error('Erro ao remover serviço'); }
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Serviços</h1>
          <p className="page-description">Cadastre seus serviços e precificações</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Serviço</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Serviço</DialogTitle></DialogHeader>
            <ServiceForm onSubmit={handleAdd} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar serviços..." className="pl-10" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wrench className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{search ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}</p>
          <p className="text-sm mt-1">{!search && 'Clique em "Novo Serviço" para começar'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(service => (
            <div key={service.id} className="bg-card rounded-xl border border-border/50 p-4 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{service.name}</p>
                  {service.description && <p className="text-sm text-muted-foreground mt-0.5 truncate">{service.description}</p>}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="font-semibold whitespace-nowrap text-success">R$ {service.price.toFixed(2)}</span>
                  <Button variant="ghost" size="icon" onClick={() => setEditingService(service)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(service)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editingService} onOpenChange={(open) => { if (!open) setEditingService(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Serviço</DialogTitle></DialogHeader>
          {editingService && <ServiceForm initial={editingService} onSubmit={handleEdit} onCancel={() => setEditingService(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Services;
