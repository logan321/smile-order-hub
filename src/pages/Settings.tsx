import { useState } from 'react';
import { BusinessConfig, loadBusinessConfig, saveBusinessConfig } from '@/lib/businessConfig';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { toast } from 'sonner';

const Settings = () => {
  const [config, setConfig] = useState<BusinessConfig>(loadBusinessConfig);

  const update = (field: keyof BusinessConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveBusinessConfig(config);
    toast.success('Configurações salvas!');
  };

  const fields: { label: string; key: keyof BusinessConfig; placeholder: string; multiline?: boolean }[] = [
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

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-description">Dados que aparecerão nos relatórios PDF enviados aos clientes</p>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 max-w-2xl">
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
          {fields.map(({ label, key, placeholder, multiline }) => (
            <div key={key}>
              <label className="text-sm font-medium mb-1.5 block">{label}</label>
              {multiline ? (
                <Textarea
                  value={config[key]}
                  onChange={e => update(key, e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                />
              ) : (
                <Input
                  value={config[key]}
                  onChange={e => update(key, e.target.value)}
                  placeholder={placeholder}
                />
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
    </div>
  );
};

export default Settings;
