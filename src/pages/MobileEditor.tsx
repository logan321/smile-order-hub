import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, RotateCcw, Shirt, Sparkles, Hand, Box, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import logoOriginal from '@/assets/logo.png';
import { ConfigIcon } from '@/components/ConfigIcon';
import { toProxyUrl } from '@/lib/imageProxy';
import Shirt3DPreview from '@/components/Shirt3DPreview';
import { cn } from '@/lib/utils';
import { useUVMap } from '@/hooks/useUVMap';
import { useSiteConfigContext } from '@/contexts/SiteConfigContext';
import { getColor, getIcon } from '@/lib/siteConfigUtils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useMobileUvCompositor, MobileUvZone } from '@/hooks/useMobileUvCompositor';

interface Niche {
  id: string;
  name: string;
  icon: string;
  patchLabel: string;
  coverImageUrl: string;
  backgroundImageUrl: string;
}

interface Template {
  id: string;
  name: string;
  frontImageUrl: string;
  backImageUrl: string;
  uvMapUrl: string | null;
  uvMapId?: string | null;
  userId: string;
  nicheId: string | null;
}

interface Stamp {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  miniaturaFrenteUrl?: string | null;
  codigo?: string | null;
  backImageUrl: string | null;
  uvMapUrl?: string | null;
  uvMapId?: string | null;
  templateId?: string | null;
  nicheId?: string | null;
}

type ToolbarTab = 'stamps' | 'text' | 'name' | 'emblems' | 'logo' | 'patches' | 'textStyles' | null;

const REGRAS_NICHO = {
  futebol: { temNumero: true, temNome: true, temEscudo: true, labelEscudo: 'Escudo', labelNome: 'Nome' },
  pesca: { temNumero: false, temNome: true, temEscudo: true, labelEscudo: 'Logo', labelNome: 'Nome' },
  ciclismo: { temNumero: false, temNome: true, temEscudo: true, labelEscudo: 'Logo', labelNome: 'Nome' },
};

const getRegraNicho = (nichoId: string) => REGRAS_NICHO[nichoId as keyof typeof REGRAS_NICHO] || REGRAS_NICHO.futebol;

const MobileEditor = () => {
  const isMobile = useIsMobile();
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState<ToolbarTab>('stamps');
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [nichoAtivo, setNichoAtivo] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 0.3, 5.2]);
  const [appliedStamp, setAppliedStamp] = useState<Stamp | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);

  const [uvTextDrafts, setUvTextDrafts] = useState<Record<string, string>>({});
  const { uvCanvas: mobileUvCanvas, version: mobileUvVersion, compose: mobileCompose } = useMobileUvCompositor();

  const { configs } = useSiteConfigContext();
  const { data: uvMapData } = useUVMap(appliedStamp?.codigo);

  const mobileZones: MobileUvZone[] = useMemo(() => [
    { id: 'full-silhouette', x: 0, y: 0, width: 100, height: 100, type: 'estampa' },
    { id: 'peito_esquerdo', x: 55, y: 35, width: 15, height: 15, type: 'escudo' },
    { id: 'peito_direito', x: 30, y: 35, width: 15, height: 15, type: 'escudo' },
    { id: 'peito_centro', x: 42, y: 38, width: 15, height: 15, type: 'escudo' },
    { id: 'costas_topo', x: 35, y: 15, width: 30, height: 10, type: 'nome' },
    { id: 'costas_centro', x: 35, y: 35, width: 30, height: 30, type: 'numero' },
    { id: 'costas_fundo', x: 35, y: 65, width: 30, height: 10, type: 'nome' },
  ], []);

  const [elementPositions, setElementPositions] = useState({ nome: 'costas_topo', escudo: 'peito_esquerdo', numero: 'costas_centro' });
  const [showNome, setShowNome] = useState(true);
  const [showNumero, setShowNumero] = useState(true);
  const [nomeColor, setNomeColor] = useState('#FFFFFF');
  const [numeroFrontColor, setNumeroFrontColor] = useState('#FFFFFF');
  const [numeroBackColor, setNumeroBackColor] = useState('#FFFFFF');
  const [nomeSize, setNomeSize] = useState(70);
  const [numeroSize, setNumeroSize] = useState(70);
  const [nomeFont, setNomeFont] = useState('Impact');
  const [numeroFont, setNumeroFont] = useState('Impact');
  const [escudoImageUrl, setEscudoImageUrl] = useState<string | null>(null);
  const [escudoScale, setEscudoScale] = useState(1);
  const [escudoOffsetX, setEscudoOffsetX] = useState(0);
  const [escudoOffsetY, setEscudoOffsetY] = useState(0);

  const nomeText = uvTextDrafts['nome'] || '';
  const numeroText = uvTextDrafts['numero'] || '';

  useEffect(() => {
    const textElements = [];
    if (showNome && nomeText && elementPositions.nome) {
      textElements.push({ id: 'nome', text: nomeText, zoneId: elementPositions.nome, color: nomeColor, fontSize: nomeSize, fontFamily: nomeFont });
    }
    if (showNumero && numeroText && elementPositions.numero) {
      textElements.push({ id: 'numero', text: numeroText, zoneId: elementPositions.numero, color: activeView === 'front' ? numeroFrontColor : numeroBackColor, fontSize: numeroSize, fontFamily: numeroFont });
    }

    mobileCompose({
      stampUrl: appliedStamp?.uvMapUrl || appliedStamp?.imageUrl,
      escudoUrl: escudoImageUrl,
      escudoScale,
      escudoOffset: { x: escudoOffsetX, y: escudoOffsetY },
      zones: mobileZones,
      textElements
    });
  }, [appliedStamp, escudoImageUrl, escudoScale, escudoOffsetX, escudoOffsetY, mobileZones, nomeText, numeroText, elementPositions, showNome, showNumero, nomeColor, numeroFrontColor, numeroBackColor, activeView, nomeSize, numeroSize, nomeFont, numeroFont, mobileCompose]);

  useEffect(() => {
    if (urlUserId) setOwnerUserId(urlUserId);
    else supabase.auth.getSession().then(({ data: { session } }) => setOwnerUserId(session?.user?.id ?? null));
  }, [urlUserId]);

  useEffect(() => {
    if (!ownerUserId) return;
    const fetchData = async () => {
      try {
        const [templatesRes, stampsRes, nichesRes] = await Promise.all([
          supabase.from('shirt_templates').select('*').eq('active', true).eq('user_id', ownerUserId),
          supabase.from('stamp_catalog').select('*').eq('user_id', ownerUserId).eq('active', true),
          supabase.from('niches').select('*').eq('user_id', ownerUserId).order('position', { ascending: true }),
        ]);

        const rawTemplates = (templatesRes.data as any[])?.map(t => ({
          id: t.id, name: t.name, frontImageUrl: t.front_image_url, backImageUrl: t.back_image_url,
          uvMapId: t.uv_map_id, uvMapUrl: t.uv_map_url, userId: t.user_id, nicheId: t.niche_id ?? null,
        })) ?? [];
        setTemplates(rawTemplates);
        if (rawTemplates.length > 0) setSelectedTemplate(rawTemplates[0]);

        setStamps((stampsRes.data as any[])?.map(s => ({
          id: s.id, name: s.name, category: s.category, imageUrl: s.image_url, miniaturaFrenteUrl: s.miniatura_frente_url,
          codigo: s.codigo, backImageUrl: s.back_image_url ?? null, nicheId: s.niche_id ?? null,
          uvMapUrl: s.uv_frente_url || s.image_url // Simplified
        })) ?? []);

        const loadedNiches = (nichesRes.data as any[])?.map(n => ({
          id: n.id, name: n.name, icon: n.icon || '🏷️', patchLabel: n.patch_label,
          coverImageUrl: n.cover_image_url || '', backgroundImageUrl: n.background_image_url || ''
        })) ?? [];
        setNiches(loadedNiches);
        if (loadedNiches.length > 0) setNichoAtivo(loadedNiches[0].id);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchData();
  }, [ownerUserId]);

  const getConfig = (key: string, fallback: string = '') => {
    // Try mobile specific key first
    const mobileKey = `mobile_${key}`;
    return configs[mobileKey]?.trim() || configs[key]?.trim() || (key === 'logo_url' ? logoOriginal : fallback);
  };

  const regrasAtuais = useMemo(() => getRegraNicho(nichoAtivo || ''), [nichoAtivo]);
  const stampsFiltrados = useMemo(() => nichoAtivo ? stamps.filter(s => s.nicheId === nichoAtivo) : stamps, [stamps, nichoAtivo]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* TEST BADGE */}
      <div className="absolute top-4 left-4 z-50 bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
        VERSÃO MOBILE DE TESTES
      </div>

      <div className="flex-1 relative bg-gray-50">
        <Shirt3DPreview 
          frontImage="" 
          backImage=""
          uvCanvas={mobileUvCanvas}
          uvVersion={mobileUvVersion}
          autoRotate={false}
          cameraPosition={cameraPosition}
          canvasBg="transparent"
          className="w-full h-full"
        />

        {/* View Selectors */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-4 z-30">
          <Button variant="outline" size="sm" onClick={() => setCameraPosition([0, 0.3, 5.2])}>FRENTE</Button>
          <Button variant="outline" size="sm" onClick={() => setCameraPosition([0, 0.3, -5.2])}>COSTAS</Button>
        </div>

        {/* Floating Menu (Simplified) */}
        <div className="absolute bottom-6 right-6 z-40">
          <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button className="w-16 h-16 rounded-full shadow-2xl bg-orange-600">
                <Menu className="w-8 h-8 text-white" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl p-6">
              <SheetHeader><SheetTitle>EDITOR MOBILE</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-6">
                 {/* Simplified Editor Controls */}
                 <div className="flex gap-4 overflow-x-auto py-2">
                    {['stamps', 'text', 'emblems'].map(tab => (
                      <Button key={tab} variant={activeTab === tab ? 'default' : 'outline'} onClick={() => setActiveTab(tab as any)}>{tab.toUpperCase()}</Button>
                    ))}
                 </div>

                 {activeTab === 'stamps' && (
                   <div className="grid grid-cols-3 gap-2 h-64 overflow-y-auto">
                     {stampsFiltrados.map(s => (
                       <button key={s.id} onClick={() => setAppliedStamp(s)} className={cn("p-1 border rounded", appliedStamp?.id === s.id && "border-orange-500")}>
                         <img src={toProxyUrl(s.miniaturaFrenteUrl || s.imageUrl)} className="w-full h-auto" />
                       </button>
                     ))}
                   </div>
                 )}

                 {activeTab === 'text' && (
                   <div className="space-y-4">
                     <Input placeholder="Nome" value={uvTextDrafts['nome'] || ''} onChange={(e) => setUvTextDrafts(prev => ({...prev, nome: e.target.value}))} />
                     <Input placeholder="Número" value={uvTextDrafts['numero'] || ''} onChange={(e) => setUvTextDrafts(prev => ({...prev, numero: e.target.value}))} />
                   </div>
                 )}

                 {activeTab === 'emblems' && (
                    <div className="space-y-4">
                       <Input type="file" onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) setEscudoImageUrl(URL.createObjectURL(file));
                       }} />
                       <div className="space-y-2">
                         <label className="text-xs">Escala</label>
                         <Slider value={[escudoScale]} min={0.5} max={2} step={0.1} onValueChange={([v]) => setEscudoScale(v)} />
                       </div>
                    </div>
                 )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
};

export default MobileEditor;
