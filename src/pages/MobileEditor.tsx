import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, RotateCcw, Shirt, Sparkles, Hand, Box, Menu, Settings, Plus, Layout } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import logoOriginal from '@/assets/logo.png';
import { ConfigIcon } from '@/components/ConfigIcon';
import { toProxyUrl } from '@/lib/imageProxy';
import Shirt3DPreview from '@/components/Shirt3DPreview';
import { cn } from '@/lib/utils';
import { useSiteConfigContext } from '@/contexts/SiteConfigContext';
import { getColor } from '@/lib/siteConfigUtils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useMobileUvCompositor, MobileUvZone } from '@/hooks/useMobileUvCompositor';

const MobileEditor = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState<'stamps' | 'text' | 'emblems' | 'config'>('stamps');
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // States for Mobile Data
  const [templates, setTemplates] = useState<any[]>([]);
  const [stamps, setStamps] = useState<any[]>([]);
  const [mobileUvMaps, setMobileUvMaps] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [appliedStamp, setAppliedStamp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);

  // Editor Config States
  const [uvTextDrafts, setUvTextDrafts] = useState<Record<string, string>>({});
  const [escudoImageUrl, setEscudoImageUrl] = useState<string | null>(null);
  const [escudoScale, setEscudoScale] = useState(1);
  const [escudoOffsetX, setEscudoOffsetX] = useState(0);
  const [escudoOffsetY, setEscudoOffsetY] = useState(0);

  const { uvCanvas: mobileUvCanvas, version: mobileUvVersion, compose: mobileCompose } = useMobileUvCompositor();
  const { configs } = useSiteConfigContext();

  const mobileZones: MobileUvZone[] = useMemo(() => [
    { id: 'full-silhouette', x: 0, y: 0, width: 100, height: 100, type: 'estampa' },
    { id: 'peito_esquerdo', x: 55, y: 35, width: 15, height: 15, type: 'escudo' },
    { id: 'peito_direito', x: 30, y: 35, width: 15, height: 15, type: 'escudo' },
    { id: 'costas_topo', x: 35, y: 15, width: 30, height: 10, type: 'nome' },
    { id: 'costas_centro', x: 35, y: 35, width: 30, height: 30, type: 'numero' },
  ], []);

  useEffect(() => {
    if (urlUserId) setOwnerUserId(urlUserId);
    else supabase.auth.getSession().then(({ data: { session } }) => setOwnerUserId(session?.user?.id ?? null));
  }, [urlUserId]);

  const fetchData = useCallback(async () => {
    if (!ownerUserId) return;
    try {
      const [templatesRes, stampsRes, uvsRes] = await Promise.all([
        supabase.from('mobile_shirt_templates').select('*').eq('user_id', ownerUserId),
        supabase.from('mobile_stamp_catalog').select('*').eq('user_id', ownerUserId),
        supabase.from('mobile_uv_maps').select('*').eq('user_id', ownerUserId),
      ]);

      setTemplates(templatesRes.data || []);
      setStamps(stampsRes.data || []);
      setMobileUvMaps(uvsRes.data || []);

      if (templatesRes.data?.length && !selectedTemplate) setSelectedTemplate(templatesRes.data[0]);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [ownerUserId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    mobileCompose({
      stampUrl: appliedStamp?.uv_frente_url || appliedStamp?.image_url,
      escudoUrl: escudoImageUrl,
      escudoScale,
      escudoOffset: { x: escudoOffsetX, y: escudoOffsetY },
      zones: mobileZones,
      textElements: [
        { id: 'nome', text: uvTextDrafts['nome'] || '', zoneId: 'costas_topo', color: '#FFF', fontSize: 70, fontFamily: 'Impact' },
        { id: 'numero', text: uvTextDrafts['numero'] || '', zoneId: 'costas_centro', color: '#FFF', fontSize: 70, fontFamily: 'Impact' },
      ]
    });
  }, [appliedStamp, escudoImageUrl, escudoScale, escudoOffsetX, escudoOffsetY, uvTextDrafts, mobileCompose]);

  // Handle Image Upload to Mobile-Specific Tables
  const handleMobileStampUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !ownerUserId) return;
    
    const fileName = `mobile-stamp-${Date.now()}`;
    const { data, error } = await supabase.storage.from('stamps').upload(fileName, file);
    if (error) return toast.error("Erro no upload");

    const { data: { publicUrl } } = supabase.storage.from('stamps').getPublicUrl(fileName);

    await supabase.from('mobile_stamp_catalog').insert({
      name: 'Nova Estampa Mobile',
      image_url: publicUrl,
      uv_frente_url: publicUrl,
      user_id: ownerUserId
    });

    toast.success("Estampa adicionada ao catálogo mobile!");
    fetchData();
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando Ambiente de Teste Mobile...</div>;

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <div className="absolute top-4 left-4 z-50 bg-yellow-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
        <Smartphone className="w-3 h-3" /> AMBIENTE ISOLADO MOBILE
      </div>

      <div className="flex-1 relative bg-gray-100">
        <Shirt3DPreview 
          frontImage="" backImage=""
          uvCanvas={mobileUvCanvas}
          uvVersion={mobileUvVersion}
          autoRotate={false}
          cameraPosition={[0, 0.3, 5.2]}
          className="w-full h-full"
        />

        {/* Floating Menu Toggle */}
        <div className="absolute bottom-6 right-6 z-40">
          <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button className="w-16 h-16 rounded-full shadow-2xl bg-black hover:bg-gray-900 border-4 border-white/20">
                <Menu className="w-8 h-8" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-[2rem] p-0 overflow-hidden border-none">
              <div className="flex flex-col h-full bg-white">
                <SheetHeader className="p-4 border-b shrink-0">
                  <SheetTitle className="text-center font-black text-xs uppercase tracking-widest">Painel de Configuração Mobile</SheetTitle>
                </SheetHeader>

                <Tabs defaultValue="editor" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="grid grid-cols-2 p-1 bg-gray-100 mx-4 mt-4">
                    <TabsTrigger value="editor">Editor</TabsTrigger>
                    <TabsTrigger value="config">Config. Dados</TabsTrigger>
                  </TabsList>

                  <TabsContent value="editor" className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {['stamps', 'text', 'emblems'].map(t => (
                        <Button key={t} variant={activeTab === t ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab(t as any)} className="uppercase text-[10px] font-bold">
                          {t}
                        </Button>
                      ))}
                    </div>

                    {activeTab === 'stamps' && (
                      <div className="grid grid-cols-3 gap-3">
                        {stamps.map(s => (
                          <button key={s.id} onClick={() => setAppliedStamp(s)} className={cn("aspect-square border-2 rounded-xl p-1 bg-gray-50", appliedStamp?.id === s.id ? "border-yellow-500" : "border-transparent")}>
                            <img src={toProxyUrl(s.image_url)} className="w-full h-full object-contain" />
                          </button>
                        ))}
                      </div>
                    )}

                    {activeTab === 'text' && (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400">NOME</label>
                          <Input value={uvTextDrafts['nome'] || ''} onChange={(e) => setUvTextDrafts(prev => ({...prev, nome: e.target.value}))} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400">NÚMERO</label>
                          <Input value={uvTextDrafts['numero'] || ''} onChange={(e) => setUvTextDrafts(prev => ({...prev, numero: e.target.value}))} />
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="config" className="flex-1 overflow-y-auto p-4 space-y-8">
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase">Catálogo de Estampas (Mobile)</h3>
                        <Button variant="outline" size="sm" onClick={() => document.getElementById('mobile-upload')?.click()}>
                          <Plus className="w-3 h-3 mr-1" /> Add Nova
                        </Button>
                        <input id="mobile-upload" type="file" className="hidden" onChange={handleMobileStampUpload} />
                      </div>
                      <p className="text-[10px] text-gray-400">Estas estampas aparecem APENAS neste simulador de teste.</p>
                      
                      <div className="border rounded-xl p-4 space-y-4">
                         {stamps.length === 0 && <p className="text-center py-8 text-gray-400 text-xs italic">Nenhuma estampa no catálogo mobile</p>}
                         {stamps.map(s => (
                           <div key={s.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                             <img src={toProxyUrl(s.image_url)} className="w-10 h-10 object-contain bg-white rounded border" />
                             <div className="flex-1">
                               <p className="text-[10px] font-bold">{s.name}</p>
                               <p className="text-[8px] text-gray-400">ID: {s.id.slice(0,8)}</p>
                             </div>
                             <Button variant="ghost" size="icon" onClick={() => {
                               supabase.from('mobile_stamp_catalog').delete().eq('id', s.id).then(() => fetchData());
                             }}>
                               <Trash2 className="w-3 h-3 text-red-400" />
                             </Button>
                           </div>
                         ))}
                      </div>
                    </section>
                  </TabsContent>
                </Tabs>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
};

// Simplified lucide import for local usage
const Smartphone = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>;

export default MobileEditor;
