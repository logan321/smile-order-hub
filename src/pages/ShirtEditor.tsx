const USE_3D_SYSTEM = true;
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, FabricText, Textbox, FabricImage, Point, Polygon, FabricObject, Control, controlsUtils } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, ChevronRight, Move, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt, Sparkles, X, Hand, Box, Check, ArrowLeft, ArrowRight, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import EditorGuide, { type GuideStep } from '@/components/EditorGuide';
import { Shadow } from 'fabric';
import { applyArcToText } from '@/lib/fabricArcText';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import logoOriginal from '@/assets/logo.png';
import { ConfigIcon } from '@/components/ConfigIcon';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';
import { toProxyUrl } from '@/lib/imageProxy';
import { fetchAllStampColors, StampColor } from '@/hooks/useStampColors';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Shirt3DPreview from '@/components/Shirt3DPreview';
import { composeUvWithStamp, loadImage as loadUvImage } from '@/lib/composeMockup';
import { useUvCompositor } from '@/hooks/useUvCompositor';
import type { UvLayer } from '@/lib/uvCompositor';
import type { UvZone } from '@/hooks/useUvLibrary';
import { cn } from '@/lib/utils';
import { useUVMap } from '@/hooks/useUVMap';
import { useSiteConfigContext } from '@/contexts/SiteConfigContext';
import { getColor, getIcon } from '@/lib/siteConfigUtils';
import { useIsMobile } from '@/hooks/useIsMobile';

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

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial', google: false },
  { label: 'Impact', value: 'Impact', google: false },
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: true },
];

const COLORS = [
  { name: 'Branco', hex: '#FFFFFF' }, { name: 'Preto', hex: '#000000' }, { name: 'Vermelho', hex: '#D50032' },
  { name: 'Azul', hex: '#003DA5' }, { name: 'Verde', hex: '#009A44' }, { name: 'Amarelo', hex: '#FFD700' },
  { name: 'Laranja', hex: '#FF8200' }, { name: 'Rosa', hex: '#F04E98' }
];

const REGRAS_NICHO = {
  futebol: { temNumero: true, temNome: true, temEscudo: true, labelEscudo: 'Escudo', labelNome: 'Nome' },
  pesca: { temNumero: false, temNome: true, temEscudo: true, labelEscudo: 'Logo', labelNome: 'Nome' },
  ciclismo: { temNumero: false, temNome: true, temEscudo: true, labelEscudo: 'Logo', labelNome: 'Nome' },
};

const getRegraNicho = (nichoId: string) => REGRAS_NICHO[nichoId as keyof typeof REGRAS_NICHO] || REGRAS_NICHO.futebol;

function StampThumb({ miniaturaUrl, imageUrl, name }: { miniaturaUrl: string | null | undefined; imageUrl: string; name: string }) {
  return <img src={toProxyUrl(miniaturaUrl || imageUrl)} alt={name} loading="lazy" decoding="async" className="w-full aspect-square object-contain p-1 bg-muted/10" />;
}

const ShirtEditor = ({ useOwnAssets }: { useOwnAssets?: boolean }) => {
  const isMobile = useIsMobile();
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const [activeTab, setActiveTab] = useState<ToolbarTab>('stamps');
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [nichoAtivo, setNichoAtivo] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [uv3DCanvas, setUv3DCanvas] = useState<HTMLCanvasElement | null>(null);
  const [uvTextureVersion, setUvTextureVersion] = useState(0);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 0.3, 5.2]);
  const [appliedStamp, setAppliedStamp] = useState<Stamp | null>(null);
  const [uvLayers, setUvLayers] = useState<UvLayer[]>([]);
  const [uvTextDrafts, setUvTextDrafts] = useState<Record<string, string>>({});
  const [uvMapZones, setUvMapZones] = useState<Record<string, UvZone>>({});
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const { data: uvMapData } = useUVMap(appliedStamp?.codigo);
  const { configs } = useSiteConfigContext();

  const getConfig = (key: string, fallback: string = '') => configs[key]?.trim() || fallback;
  const regrasAtuais = useMemo(() => getRegraNicho(nichoAtivo || ''), [nichoAtivo]);
  const stampsFiltrados = useMemo(() => (!nichoAtivo ? stamps : stamps.filter(s => s.nicheId === nichoAtivo)), [stamps, nichoAtivo]);

  useEffect(() => {
    let active = true;
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = urlUserId || session?.user?.id || 'public';
      setOwnerUserId(userId);

      const [templatesRes, stampsRes, nichesRes] = await Promise.all([
        supabase.from('shirt_templates').select('*').eq('active', true),
        supabase.from('stamp_catalog').select('*').eq('active', true),
        supabase.from('niches').select('*').order('position', { ascending: true })
      ]);

      if (active) {
        setStamps((stampsRes.data as any[])?.map(s => ({
          id: s.id, name: s.name, category: s.category, imageUrl: s.image_url, miniaturaFrenteUrl: s.miniatura_frente_url,
          codigo: s.codigo, backImageUrl: s.back_image_url, nicheId: s.niche_id, uvMapUrl: s.uv_map_url, uvMapId: s.uv_map_id
        })) ?? []);
        setNiches(nichesRes.data ?? []);
        setTemplates((templatesRes.data as any[])?.map(t => ({
          id: t.id, name: t.name, frontImageUrl: t.front_image_url, backImageUrl: t.back_image_url, uvMapId: t.uv_map_id, uvMapUrl: t.uv_map_url, userId: t.user_id, nicheId: t.niche_id
        })) ?? []);
        setLoading(false);
      }
    };
    fetch();
    return () => { active = false; };
  }, [urlUserId]);

  const addStamp = (stamp: Stamp) => setAppliedStamp(stamp);

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  if (!loading && stamps.length === 0) return <div className="h-screen flex items-center justify-center">Nenhuma estampa encontrada.</div>;

  return (
    <div className="h-screen flex flex-col">
       {/* Catálogo Mobile */}
       {isMobile && (
         <div className="bg-white p-2 border-b flex gap-2 overflow-x-auto">
           {stampsFiltrados.map(s => (
             <button key={s.id} onClick={() => addStamp(s)} className="w-16 h-16 border rounded-lg overflow-hidden shrink-0">
               <StampThumb miniaturaUrl={s.miniaturaFrenteUrl} imageUrl={s.imageUrl} name={s.name} />
             </button>
           ))}
         </div>
       )}
       
       <div className="flex-1 overflow-hidden relative">
         <Shirt3DPreview frontImage={selectedTemplate?.frontImageUrl || ''} backImage={selectedTemplate?.backImageUrl || ''} uvMapUrl={appliedStamp?.uvMapUrl || selectedTemplate?.uvMapUrl} uvCanvas={uv3DCanvas} />
       </div>
    </div>
  );
};
export default ShirtEditor;