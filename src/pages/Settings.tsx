import { useState } from 'react';
import { BusinessConfig, loadBusinessConfig, saveBusinessConfig } from '@/lib/businessConfig';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Save, ListOrdered, FileText, Plus, Trash2, Pencil, GripVertical, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { generateUserManualPDF } from '@/lib/generateManualPDF';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useOrderStages } from '@/hooks/useOrderStages';
import { useCustomFields } from '@/hooks/useCustomFields';

const Settings = () => {
  const [config, setConfig] = useState<BusinessConfig>(loadBusinessConfig);
  const { stages, loading: stagesLoading, addStage, updateStage, deleteStage, reorderStages, initDefaults } = useOrderStages();
  const { fields, loading: fieldsLoading, addField, updateField, deleteField } = useCustomFields();

  // Payment settings
  const update = (field: keyof BusinessConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveBusinessConfig(config);
    toast.success('Configurações salvas!');
  };

  const paymentFields: { label: string; key: keyof BusinessConfig; placeholder: string; multiline?: boolean }[] = [
    { label: 'Nome da Empresa / Profissional', key: 'businessName', placeholder: 'Ex: Studio Design' },
    { label: 'Seu Nome', key: 'ownerName', placeholder: 'Ex: João Silva' },
    { label: 'Telefone', key: 'phone', placeholder: '(00) 00000-0000' },
    { label: 'E-mail', key: 'email', placeholder: 'contato@empresa.com' },
    { label: 'CPF / CNPJ', key: 'document', placeholder: '000.000.000-00' },
    { label: 'Formas de Pagamento', key: 'paymentMethods', placeholder: 'Ex: PIX, Transferência bancária, Cartão de crédito' },
    { label: 'Chave PIX', key: 'pixKey', placeholder: 'Ex: email@pix.com ou CPF' },
    { label: 'Dados Bancários', key: 'bankInfo', placeholder: 'Ex: Banco X, Ag 0001, CC 12345-6', multiline: true },
    { label: 'Observações adicionais', key: 'extraNotes', placeholder: 'Informações extras que aparecerão no relatório', multiline: true },
  ];

  // Stages management
  const [newStageName, setNewStageName] = useState('');
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState('');

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    await addStage(newStageName.trim());
    setNewStageName('');
    toast.success('Etapa adicionada!');
  };

  const handleUpdateStage = async (id: string) => {
    if (!editingStageName.trim()) return;
    await updateStage(id, editingStageName.trim());
    setEditingStageId(null);
    toast.success('Etapa atualizada!');
  };

  const handleDeleteStage = async (id: string) => {
    if (confirm('Remover esta etapa?')) {
      await deleteStage(id);
      toast.success('Etapa removida!');
    }
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const newStages = [...stages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
    reorderStages(newStages.map((s, i) => ({ ...s, position: i })));
  };

  // Custom fields management
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldName, setEditingFieldName] = useState('');
  const [editingFieldType, setEditingFieldType] = useState('text');
  const [editingFieldOptions, setEditingFieldOptions] = useState('');

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;
    const opts = newFieldType === 'select' ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean) : [];
    await addField(newFieldName.trim(), newFieldType, opts);
    setNewFieldName('');
    setNewFieldType('text');
    setNewFieldOptions('');
    toast.success('Campo adicionado!');
  };

  const handleUpdateField = async (id: string) => {
    if (!editingFieldName.trim()) return;
    const opts = editingFieldType === 'select' ? editingFieldOptions.split(',').map(o => o.trim()).filter(Boolean) : [];
    await updateField(id, editingFieldName.trim(), editingFieldType, opts);
    setEditingFieldId(null);
    toast.success('Campo atualizado!');
  };

  const handleDeleteField = async (id: string) => {
    if (confirm('Remover este campo?')) {
      await deleteField(id);
      toast.success('Campo removido!');
    }
  };

  const fieldTypeLabels: Record<string, string> = {
    text: 'Texto', number: 'Número', date: 'Data', select: 'Seleção',
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-description">Configure os dados da sua empresa e personalize seu fluxo de trabalho</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => generateUserManualPDF()} className="gap-2">
          <Download className="h-4 w-4" />
          Manual PDF
        </Button>
      </div>

      <Tabs defaultValue="payment" className="max-w-3xl">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="payment" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            Relatório
          </TabsTrigger>
          <TabsTrigger value="stages" className="gap-2">
            <ListOrdered className="h-4 w-4" />
            Etapas
          </TabsTrigger>
          <TabsTrigger value="fields" className="gap-2">
            <FileText className="h-4 w-4" />
            Campos
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Payment / Report data */}
        <TabsContent value="payment">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <SettingsIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Dados do Relatório</h2>
                <p className="text-sm text-muted-foreground">Estas informações serão incluídas no PDF</p>
              </div>
            </div>

            <div className="space-y-4">
              {paymentFields.map(({ label, key, placeholder, multiline }) => (
                <div key={key}>
                  <label className="text-sm font-medium mb-1.5 block">{label}</label>
                  {multiline ? (
                    <Textarea value={config[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} rows={3} />
                  ) : (
                    <Input value={config[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Custom order stages */}
        <TabsContent value="stages">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ListOrdered className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Etapas do Pedido</h2>
                <p className="text-sm text-muted-foreground">Crie e organize as etapas do fluxo de produção dos seus pedidos</p>
              </div>
            </div>

            {stagesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                {stages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground mb-4">
                    <p className="text-sm">Nenhuma etapa configurada</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={initDefaults}>
                      Carregar etapas padrão
                    </Button>
                  </div>
                )}

                <div className="space-y-2 mb-4">
                  {stages.map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground w-6">{index + 1}</span>

                      {editingStageId === stage.id ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={editingStageName}
                            onChange={e => setEditingStageName(e.target.value)}
                            className="h-8"
                            onKeyDown={e => e.key === 'Enter' && handleUpdateStage(stage.id)}
                          />
                          <Button size="sm" onClick={() => handleUpdateStage(stage.id)}>Salvar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingStageId(null)}>Cancelar</Button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium">{stage.name}</span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStage(index, 'up')} disabled={index === 0}>
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStage(index, 'down')} disabled={index === stages.length - 1}>
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingStageId(stage.id); setEditingStageName(stage.name); }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteStage(stage.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={newStageName}
                    onChange={e => setNewStageName(e.target.value)}
                    placeholder="Nome da nova etapa"
                    onKeyDown={e => e.key === 'Enter' && handleAddStage()}
                  />
                  <Button onClick={handleAddStage} disabled={!newStageName.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Custom fields for confection orders */}
        <TabsContent value="fields">
          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Campos de Confecção</h2>
                <p className="text-sm text-muted-foreground">Defina os campos personalizados que aparecerão no pedido de confecção (ficha técnica)</p>
              </div>
            </div>

            {fieldsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                {fields.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground mb-4">
                    <p className="text-sm">Nenhum campo configurado. Adicione campos como Tecido, Modelo de Molde, etc.</p>
                  </div>
                )}

                <div className="space-y-2 mb-6">
                  {fields.map(field => (
                    <div key={field.id} className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                      {editingFieldId === field.id ? (
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <Input value={editingFieldName} onChange={e => setEditingFieldName(e.target.value)} placeholder="Nome do campo" className="h-8" />
                            <Select value={editingFieldType} onValueChange={setEditingFieldType}>
                              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Texto</SelectItem>
                                <SelectItem value="number">Número</SelectItem>
                                <SelectItem value="date">Data</SelectItem>
                                <SelectItem value="select">Seleção</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {editingFieldType === 'select' && (
                            <Input value={editingFieldOptions} onChange={e => setEditingFieldOptions(e.target.value)} placeholder="Opções separadas por vírgula" className="h-8" />
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleUpdateField(field.id)}>Salvar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingFieldId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{field.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Tipo: {fieldTypeLabels[field.fieldType] ?? field.fieldType}
                              {field.fieldType === 'select' && field.options.length > 0 && ` (${field.options.join(', ')})`}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditingFieldId(field.id);
                            setEditingFieldName(field.name);
                            setEditingFieldType(field.fieldType);
                            setEditingFieldOptions(field.options.join(', '));
                          }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteField(field.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-3 border-t border-border/50 pt-4">
                  <p className="text-sm font-medium">Adicionar novo campo</p>
                  <div className="flex gap-2">
                    <Input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Nome do campo (ex: Tecido)" />
                    <Select value={newFieldType} onValueChange={setNewFieldType}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="number">Número</SelectItem>
                        <SelectItem value="date">Data</SelectItem>
                        <SelectItem value="select">Seleção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newFieldType === 'select' && (
                    <Input value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} placeholder="Opções separadas por vírgula (ex: Algodão, Poliéster, Malha)" />
                  )}
                  <Button onClick={handleAddField} disabled={!newFieldName.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Campo
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
