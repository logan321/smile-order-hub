import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shirt, Upload, Plus, Trash2, Smartphone, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MobileEditorSettingsProps {
  targetUserId?: string;
}

const MobileEditorSettings = ({ targetUserId }: MobileEditorSettingsProps = {}) => {
  const [loading, setLoading] = useState(true);
  const [stamps, setStamps] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [uvMaps, setUvMaps] = useState<any[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);

  // Form states
  const [newStampName, setNewStampName] = useState('');
  const [stampFile, setStampFile] = useState<File | null>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (targetUserId) {
      setOwnerUserId(targetUserId);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setOwnerUserId(session?.user?.id ?? null);
      });
    }
  }, [targetUserId]);

  const fetchData = async () => {
    if (!ownerUserId) return;
    setLoading(true);
    try {
      const [stampsRes, templatesRes, uvsRes] = await Promise.all([
        supabase.from('mobile_stamp_catalog').select('*').eq('user_id', ownerUserId).order('created_at', { ascending: false }),
        supabase.from('mobile_shirt_templates').select('*').eq('user_id', ownerUserId),
        supabase.from('mobile_uv_maps').select('*').eq('user_id', ownerUserId),
      ]);
      setStamps(stampsRes.data || []);
      setTemplates(templatesRes.data || []);
      setUvMaps(uvsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ownerUserId) fetchData();
  }, [ownerUserId]);

  const handleAddStamp = async () => {
    if (!newStampName.trim() || !stampFile || !ownerUserId) {
      toast.error('Preencha o nome e selecione um arquivo');
      return;
    }
    setUploading(true);
    try {
      const ts = Date.now();
      const path = `${ownerUserId}/mobile-stamps/${ts}_${stampFile.name}`;
      const { error: upErr } = await supabase.storage.from('stamps').upload(path, stampFile);
      if (upErr) throw upErr;

      const imageUrl = supabase.storage.from('stamps').getPublicUrl(path).data.publicUrl;

      const { error: dbErr } = await supabase.from('mobile_stamp_catalog').insert({
        user_id: ownerUserId,
        name: newStampName,
        image_url: imageUrl,
        uv_frente_url: imageUrl,
        active: true
      });

      if (dbErr) throw dbErr;
      
      toast.success('Estampa de teste adicionada!');
      setNewStampName('');
      setStampFile(null);
      if (stampRef.current) stampRef.current.value = '';
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteStamp = async (id: string) => {
    if (!confirm('Excluir esta estampa de teste?')) return;
    await supabase.from('mobile_stamp_catalog').delete().eq('id', id);
    fetchData();
    toast.success('Removido!');
  };

  if (!ownerUserId) return null;

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-orange-100">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-orange-50">
        <div className="p-2 bg-orange-500 rounded-lg text-white">
          <Smartphone className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest text-gray-900">Configurações do Simulador Mobile (Teste)</h2>
          <p className="text-sm text-gray-500 font-medium">Laboratório isolado para correções no Android</p>
        </div>
      </div>

      <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-8 flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
        <p className="text-xs text-orange-800 leading-relaxed font-medium">
          <strong>Atenção:</strong> Tudo o que você configurar aqui é <strong>exclusivo</strong> da versão de teste mobile. 
          Nada interfere no seu simulador principal de produção. Use este espaço para carregar imagens de teste e validar se o carregamento no Android funciona.
        </p>
      </div>

      <Tabs defaultValue="stamps" className="w-full">
        <TabsList className="grid grid-cols-2 mb-8 bg-gray-50 p-1">
          <TabsTrigger value="stamps" className="gap-2">
            <Plus className="w-4 h-4" /> Catálogo Mobile
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-2">
            <AlertCircle className="w-4 h-4" /> Instruções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stamps" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Adicionar Nova Estampa de Teste</h3>
              <div className="space-y-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">Nome da Estampa</label>
                  <Input 
                    placeholder="Ex: Teste UV Android" 
                    value={newStampName}
                    onChange={(e) => setNewStampName(e.target.value)}
                    className="h-11 bg-white border-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">Arquivo de Imagem (UV)</label>
                  <Input 
                    type="file" 
                    ref={stampRef}
                    onChange={(e) => setStampFile(e.target.files?.[0] || null)}
                    className="h-11 bg-white border-gray-200"
                  />
                </div>
                <Button 
                  onClick={handleAddStamp} 
                  disabled={uploading}
                  className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest gap-2 shadow-lg"
                >
                  {uploading ? 'Enviando...' : <><Plus className="w-4 h-4" /> Importar para Teste</>}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Estampas no Laboratório ({stamps.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {stamps.map(s => (
                  <div key={s.id} className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                    <img src={toProxyUrl(s.image_url)} className="w-full h-full object-contain p-2" alt="" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                      <span className="text-[8px] text-white font-black uppercase mb-2 truncate w-full">{s.name}</span>
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        onClick={() => deleteStamp(s.id)}
                        className="h-7 w-7 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {stamps.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400 font-medium">Nenhuma estampa de teste carregada</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="info" className="space-y-4 text-sm text-gray-600 leading-relaxed p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p>Este ambiente foi criado para isolar completamente os seus testes de correção para Android.</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Catálogo Próprio:</strong> As estampas que você importar aqui não aparecem no seu site oficial.</li>
            <li><strong>UVs de Teste:</strong> Você pode subir diferentes moldes UV para testar qual formato carrega melhor em dispositivos móveis.</li>
            <li><strong>Método de Importação:</strong> O processo é idêntico ao original (upload e cadastro no catálogo), mas os dados vão para a tabela <code className="bg-white px-1 rounded text-orange-600 font-mono">mobile_stamp_catalog</code>.</li>
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const toProxyUrl = (url: string) => url; // Simplified for now

export default MobileEditorSettings;
