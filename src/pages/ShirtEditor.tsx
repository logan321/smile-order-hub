const USE_3D_SYSTEM = true;
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, FabricText, Textbox, FabricImage, Point, Polygon, FabricObject, Control, controlsUtils } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, ChevronRight, Move, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt, Sparkles, X, Hand, Box, Check } from 'lucide-react';
import EditorGuide, { type GuideStep } from '@/components/EditorGuide';
import { Shadow } from 'fabric';
import { applyArcToText } from '@/lib/fabricArcText';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
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
  backImageUrl: string | null;
  uvMapUrl?: string | null;
  uvMapId?: string | null;
  templateId?: string | null;
  nicheId?: string | null;
}

type ToolbarTab = 'stamps' | 'text' | 'name' | 'emblems' | 'logo' | 'patches' | 'textStyles' | null;

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 625;

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial', google: false },
  { label: 'Impact', value: 'Impact', google: false },
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: true },
];

const COLORS = [
  { name: 'Branco', hex: '#FFFFFF' },
  { name: 'Cinza Claro', hex: '#CACCCB' },
  { name: 'Cinza Médio', hex: '#98999A' },
  { name: 'Cinza Escuro', hex: '#63666A' },
  { name: 'Grafite', hex: '#333F48' },
  { name: 'Chumbo', hex: '#2D2926' },
  { name: 'Preto', hex: '#000000' },
  { name: 'Amarelo Claro', hex: '#F6EB61' },
  { name: 'Amarelo Canário', hex: '#FFD700' },
  { name: 'Amarelo Mostarda', hex: '#EAAA00' },
  { name: 'Ocre', hex: '#C3922E' },
  { name: 'Dourado', hex: '#84754E' },
  { name: 'Laranja Claro', hex: '#FFB549' },
  { name: 'Laranja', hex: '#FF8200' },
  { name: 'Terracota', hex: '#CB6015' },
  { name: 'Coral', hex: '#FF7378' },
  { name: 'Vermelho Vivo', hex: '#EF3340' },
  { name: 'Vermelho', hex: '#D50032' },
  { name: 'Vermelho Médio', hex: '#BD162C' },
  { name: 'Vinho', hex: '#782327' },
  { name: 'Bordô', hex: '#441E1E' },
  { name: 'Rosa Claro', hex: '#F8A7B8' },
  { name: 'Rosa', hex: '#F04E98' },
  { name: 'Pink', hex: '#DA1884' },
  { name: 'Magenta', hex: '#E10098' },
  { name: 'Magenta Escuro', hex: '#8B004B' },
  { name: 'Lavanda', hex: '#D7C6E6' },
  { name: 'Lilás', hex: '#864BAE' },
  { name: 'Violeta', hex: '#440099' },
  { name: 'Roxo', hex: '#2E1A47' },
  { name: 'Azul Claro', hex: '#B9D9EB' },
  { name: 'Turquesa', hex: '#53B0AE' },
  { name: 'Ciano', hex: '#15A3C7' },
  { name: 'Celeste', hex: '#00A3E0' },
  { name: 'Royal', hex: '#003DA5' },
  { name: 'Azul Escuro', hex: '#001E60' },
  { name: 'Marinho', hex: '#002147' },
  { name: 'Verde Limão', hex: '#97D700' },
  { name: 'Verde Claro', hex: '#6CC24A' },
  { name: 'Esmeralda', hex: '#009A44' },
  { name: 'Verde Bandeira', hex: '#007A33' },
  { name: 'Musgo', hex: '#4A7729' },
  { name: 'Verde Escuro', hex: '#215732' },
  { name: 'Areia', hex: '#E0C6A3' },
  { name: 'Bege', hex: '#C6AA76' },
  { name: 'Marrom Claro', hex: '#B58150' },
  { name: 'Marrom Escuro', hex: '#3E2B2E' },
  { name: 'Chocolate', hex: '#472311' }
];

// NICHOS_ESTATICOS removido para usar os nichos vindo do banco (setNiches)

const REGRAS_NICHO = {
  futebol: {
    temNumero: true,
    temNome: true,
    temEscudo: true,
    labelEscudo: 'Escudo',
    labelNome: 'Nome',
  },
  pesca: {
    temNumero: false,
    temNome: true,
    temEscudo: true,
    labelEscudo: 'Logo',
    labelNome: 'Nome',
  },
  ciclismo: {
    temNumero: false,
    temNome: true,
    temEscudo: true,
    labelEscudo: 'Logo',
    labelNome: 'Nome',
  },
};

const getRegraNicho = (nichoId: string) => {
  return REGRAS_NICHO[nichoId as keyof typeof REGRAS_NICHO] || REGRAS_NICHO.futebol;
};

function StampThumb({ stampUrl, name }: { stampUrl: string; name: string }) {
  return (
    <img
      src={toProxyUrl(stampUrl)}
      alt={name}
      loading="lazy"
      decoding="async"
      className="w-full aspect-square object-contain p-1 bg-muted/10"
    />
  );
}

const ShirtEditor = ({ useOwnAssets }: { useOwnAssets?: boolean }) => {
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontFabricRef = useRef<Canvas | null>(null);
  const backFabricRef = useRef<Canvas | null>(null);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState<ToolbarTab>('stamps');
  const [showUvPanel, setShowUvPanel] = useState(true);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [allStamps, setAllStamps] = useState<Stamp[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [nichoAtivo, setNichoAtivo] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [uv3DCanvas, setUv3DCanvas] = useState<HTMLCanvasElement | null>(null);
  const [uvTextureVersion, setUvTextureVersion] = useState(0);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 0.1, 5.2]);
  const [appliedStamp, setAppliedStamp] = useState<Stamp | null>(null);
  const [fallbackUvUrl, setFallbackUvUrl] = useState<string | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);

  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(70);
  const [fontFamily, setFontFamily] = useState('Impact');
  const [uvLayers, setUvLayers] = useState<UvLayer[]>([]);
  const [uvTextDrafts, setUvTextDrafts] = useState<Record<string, string>>({});
  const [uvMapZones, setUvMapZones] = useState<Record<string, UvZone>>({});

  const DEFAULT_ELEMENT_POSITIONS = {
    nome: 'costas_topo',
    escudo: 'peito_esquerdo',
    numero: 'costas_centro'
  };

  const [elementPositions, setElementPositions] = useState<{ nome: string | null; escudo: string | null; numero: string | null }>(DEFAULT_ELEMENT_POSITIONS);
  const [showNome, setShowNome] = useState(true);
  const [showNumero, setShowNumero] = useState(true);
  const [nomeColor, setNomeColor] = useState('#FFFFFF');
  const [nomeBorderColor, setNomeBorderColor] = useState('transparent');
  const [numeroFrontColor, setNumeroFrontColor] = useState('#FFFFFF');
  const [numeroFrontBorderColor, setNumeroFrontBorderColor] = useState('transparent');
  const [numeroBackColor, setNumeroBackColor] = useState('#FFFFFF');
  const [numeroBackBorderColor, setNumeroBackBorderColor] = useState('transparent');
  const [nomeSize, setNomeSize] = useState(70);
  const [numeroSize, setNumeroSize] = useState(70);
  const [nomeFont, setNomeFont] = useState('Impact');
  const [numeroFont, setNumeroFont] = useState('Impact');
  const [selectedLayoutId, setSelectedLayoutId] = useState('c1');
  const [escudoImageUrl, setEscudoImageUrl] = useState<string | null>(null);
  const [escudoScale, setEscudoScale] = useState(1); // 1 = 100% = 6% do UV width
  const [escudoOffsetX, setEscudoOffsetX] = useState(0);
  const [escudoOffsetY, setEscudoOffsetY] = useState(0);

  const [debouncedEscudoScale, setDebouncedEscudoScale] = useState(1);
  const [debouncedEscudoOffsetX, setDebouncedEscudoOffsetX] = useState(0);
  const [debouncedEscudoOffsetY, setDebouncedEscudoOffsetY] = useState(0);

  const regrasAtuais = useMemo(() => getRegraNicho(nichoAtivo), [nichoAtivo]);

  const stampsFiltrados = useMemo(() => {
    if (!nichoAtivo) return stamps;
    return stamps.filter(s => s.nicheId === nichoAtivo); 
  }, [stamps, nichoAtivo]);

  const handleNichoChange = (newNichoId: string) => {
    setNichoAtivo(newNichoId);
    setElementPositions(DEFAULT_ELEMENT_POSITIONS);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEscudoScale(escudoScale);
      setDebouncedEscudoOffsetX(escudoOffsetX);
      setDebouncedEscudoOffsetY(escudoOffsetY);
      setUvTextureVersion(v => v + 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [escudoScale, escudoOffsetX, escudoOffsetY]);

  const COMBINACOES_ESPORTE = [
    { id: 'c1', nome: 'costas_topo', numero: 'costas_centro', escudo: 'peito_esquerdo' },
    { id: 'c2', nome: 'costas_fundo', numero: 'costas_centro', escudo: 'peito_esquerdo' },
    { id: 'c3', nome: 'costas_topo', numero: 'peito_direito', escudo: 'peito_esquerdo' },
    { id: 'c4', nome: null, numero: 'costas_centro', escudo: 'peito_esquerdo' },
    { id: 'c5', nome: null, numero: 'peito_centro', escudo: 'peito_esquerdo' },
    { id: 'c6', nome: null, numero: 'peito_direito', escudo: 'peito_esquerdo' },
  ];

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const aplicarEscudo = useCallback((imageUrl: string | null) => {
    setEscudoImageUrl(imageUrl);
    setUvTextureVersion(v => v + 1);
  }, []);

  const handleEscudoUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 10MB");
      return;
    }

    if (file.type === 'application/pdf') {
      try {
        // @ts-ignore
        const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
        if (!pdfjsLib) {
          toast.error("Carregando processador de PDF, tente novamente em instantes.");
          return;
        }
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            aplicarEscudo(url);
          }
        }, 'image/png');
      } catch (error) {
        console.error("Erro ao processar PDF:", error);
        toast.error("Erro ao processar o arquivo PDF");
      }
    } else {
      const url = URL.createObjectURL(file);
      aplicarEscudo(url);
    }
  };

  const ShirtLayoutOption = ({ 
    nomePos, 
    numeroPos, 
    escudoPos, 
    selected, 
    onClick 
  }: { 
    nomePos: string | null; 
    numeroPos: string | null; 
    escudoPos: string | null; 
    selected: boolean; 
    onClick: () => void;
  }) => {
    const color = selected ? '#FF5A00' : '#e5e7eb';
    
    const getPos = (pos: string | null) => {
      switch(pos) {
        case 'peito_direito': return { x: '35%', y: '35%' };
        case 'peito_esquerdo': return { x: '55%', y: '35%' };
        case 'peito_centro': return { x: '45%', y: '38%' };
        case 'costas_topo': return { x: '45%', y: '25%' };
        case 'costas_centro': return { x: '45%', y: '45%' };
        case 'costas_fundo': return { x: '45%', y: '60%' };
        default: return null;
      }
    };

    const nomeCoords = getPos(nomePos);
    const numeroCoords = getPos(numeroPos);
    const escudoCoords = getPos(escudoPos);

    const isBack = (pos: string | null) => pos?.startsWith('costas');

    return (
      <button 
        onClick={onClick}
        className={cn(
          "relative group rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 p-2 bg-white min-w-[110px] min-h-[120px]",
          selected ? "border-[#FF5A00] bg-[#FF5A00]/5" : "border-gray-100 hover:border-gray-200"
        )}
        style={{ borderWidth: selected ? '3px' : '2px' }}
      >
        <div className="flex gap-2 items-center justify-center">
          <svg width="45" height="55" viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Front Mini */}
            <path d="M30 20 L15 35 L20 55 L20 110 L100 110 L100 55 L105 35 L90 20 L75 25 L45 25 Z" stroke={color} strokeWidth="3" />
            <circle cx="60" cy="22" r="8" stroke={color} strokeWidth="3" />
            
            {!isBack(nomePos) && nomeCoords && (
              <text x={nomeCoords.x} y={nomeCoords.y} fill={color} fontSize="10" fontWeight="900" textAnchor="middle">NOME</text>
            )}
            {!isBack(numeroPos) && numeroCoords && (
              <text x={numeroCoords.x} y={numeroCoords.y} fill={color} fontSize="18" fontWeight="900" textAnchor="middle">10</text>
            )}
            {!isBack(escudoPos) && escudoCoords && (
              <rect x="52%" y="32%" width="12" height="12" fill={color} />
            )}
          </svg>
          
          <svg width="45" height="55" viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Back Mini */}
            <path d="M30 20 L15 35 L20 55 L20 110 L100 110 L100 55 L105 35 L90 20 L75 25 L45 25 Z" stroke={color} strokeWidth="3" />
            
            {isBack(nomePos) && nomeCoords && (
              <text x={nomeCoords.x} y={nomeCoords.y} fill={color} fontSize="10" fontWeight="900" textAnchor="middle">NOME</text>
            )}
            {isBack(numeroPos) && numeroCoords && (
              <text x={numeroCoords.x} y={numeroCoords.y} fill={color} fontSize="18" fontWeight="900" textAnchor="middle">10</text>
            )}
          </svg>
        </div>
        
        {selected && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-[#FF5A00] rounded-full flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="w-3 h-3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </button>
    );
  };

  const [flyingElement, setFlyingElement] = useState<{
    content: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const [animatingElement, setAnimatingElement] = useState<any>(null);
  
  const [uvMapDims, setUvMapDims] = useState<{ w: number | null; h: number | null }>({ w: null, h: null });

  const uvTextCommitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (urlUserId) {
      setOwnerUserId(urlUserId);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setOwnerUserId(session?.user?.id ?? null);
      });
    }
  }, [urlUserId]);

  useEffect(() => {
    if (!ownerUserId) return;
    const fetchData = async () => {
      const [templatesRes, stampsRes, nichesRes, uvMapsRes] = await Promise.all([
        supabase.from('shirt_templates').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('stamp_catalog').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('niches').select('*').eq('user_id', ownerUserId).order('position', { ascending: true }),
        supabase.from('uv_maps' as any).select('id, image_url, code, name').eq('user_id', ownerUserId),
      ]);

      const rawTemplates = (templatesRes.data as any[])?.map(t => ({
        id: t.id, name: t.name, frontImageUrl: t.front_image_url, backImageUrl: t.back_image_url,
        uvMapId: t.uv_map_id, uvMapUrl: t.uv_map_url,
        userId: t.user_id, nicheId: t.niche_id ?? null,
      })) ?? [];

      setAllTemplates(rawTemplates);
      setTemplates(rawTemplates);
      
      // Se houver apenas um template, seleciona-o automaticamente
      if (rawTemplates.length === 1) {
        setSelectedTemplate(rawTemplates[0]);
      }

      setStamps((stampsRes.data as any[])?.map(s => ({
        id: s.id, name: s.name, category: s.category, imageUrl: s.image_url, backImageUrl: s.back_image_url ?? null,
        uvMapUrl: s.uv_map_url,
        uvMapId: s.uv_map_id,
        nicheId: s.niche_id ?? null,
      })) ?? []);
      const loadedNiches = (nichesRes.data as any[])?.map(n => ({
        id: n.id,
        name: n.name,
        icon: n.icon || '🏷️',
        patchLabel: n.patch_label,
        coverImageUrl: n.cover_image_url || '',
        backgroundImageUrl: n.background_image_url || ''
      })) ?? [];
      setNiches(loadedNiches);
      
      if (loadedNiches.length > 0 && !nichoAtivo) {
        setNichoAtivo(loadedNiches[0].id);
      }
      setLoading(false);
    };
    fetchData();
  }, [ownerUserId]);

  const prevUvMapIdRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const uvMapId = appliedStamp?.uvMapId || selectedTemplate?.uvMapId || null;
    
    if (!uvMapId) { 
      setUvMapZones({}); 
      setUvMapDims({ w: null, h: null }); 
      setUvLayers([]); 
      setFallbackUvUrl(null);
      prevUvMapIdRef.current = null;
      return; 
    }
    
    // Only reset layers and fetch if the UV Map actually changed
    if (prevUvMapIdRef.current === uvMapId) return;
    prevUvMapIdRef.current = uvMapId;

    (async () => {
      const { data } = await supabase
        .from('uv_maps' as any)
        .select('image_url, uv_zones, uv_width, uv_height')
        .eq('id', uvMapId)
        .maybeSingle();
      
      if (cancelled || !data) return;
      
      const row = data as any;
      setUvMapZones((row.uv_zones && typeof row.uv_zones === 'object') ? row.uv_zones : {});
      setUvMapDims({ w: row.uv_width ?? null, h: row.uv_height ?? null });
      setFallbackUvUrl(row.image_url || null);
      
      // Reset layers when the mold changes
      setUvLayers([]);
      setUvTextDrafts({});
    })();
    return () => { cancelled = true; };
  }, [appliedStamp?.uvMapId, selectedTemplate?.uvMapId]);

  const moveElementRef = useRef<any>(null);
  moveElementRef.current = (tipo: 'nome' | 'escudo' | 'numero', novaPosicao: string | null) => {
    const zonaAntigaKey = elementPositions[tipo];
    
    // Se a nova posição for nula, apenas removemos o elemento das posições
    if (!novaPosicao) {
      setElementPositions(prev => ({ ...prev, [tipo]: null }));
      return;
    }

    const layerId = tipo === 'nome' ? 'layer_nome' : tipo === 'numero' ? 'layer_numero' : 'layer_escudo';
    const layer = uvLayers.find(l => l.id === layerId);

    if (layer && typeof document !== 'undefined' && zonaAntigaKey) {
      const fromBtn = document.querySelector(`[data-pos-id="${zonaAntigaKey}"][data-tipo="${tipo}"]`);
      const toBtn = document.querySelector(`[data-pos-id="${novaPosicao}"][data-tipo="${tipo}"]`);

      if (fromBtn && toBtn) {
        const fromRect = fromBtn.getBoundingClientRect();
        const toRect = toBtn.getBoundingClientRect();

        setFlyingElement({
          content: layer.type === 'text' ? layer.content : 'Logo',
          from: { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 },
          to: { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 }
        });

        setTimeout(() => setFlyingElement(null), 650);
      }
    }

    setElementPositions(prev => {
      let next = { ...prev };
      const posicoesPeito = ['peito_direito', 'peito_esquerdo'];

      if (tipo === 'nome') {
        next.nome = novaPosicao;
        if (novaPosicao && novaPosicao === next.escudo) {
          next.escudo = novaPosicao === 'peito_direito' ? 'peito_esquerdo' : 'peito_direito';
        }
      } else if (tipo === 'escudo') {
        const anteriorEscudo = next.escudo;
        next.escudo = novaPosicao;
        
        // Regra Nome vs Escudo
        if (novaPosicao && novaPosicao === next.nome) {
          next.nome = novaPosicao === 'peito_direito' ? 'peito_esquerdo' : 'peito_direito';
        }
        
        // Regra Escudo vs Número (Apenas em peito_direito ou peito_esquerdo)
        if (novaPosicao && posicoesPeito.includes(novaPosicao) && novaPosicao === next.numero) {
          next.numero = anteriorEscudo;
        }
      } else if (tipo === 'numero') {
        const anteriorNumero = next.numero;
        next.numero = novaPosicao;
        
        // Regra Escudo vs Número (Apenas em peito_direito ou peito_esquerdo)
        if (novaPosicao && posicoesPeito.includes(novaPosicao) && novaPosicao === next.escudo) {
          next.escudo = anteriorNumero;
        }
      }
      return next;
    });
  };

  const moveElement = useCallback((tipo: 'nome' | 'escudo' | 'numero', novaPosicao: string | null) => {
    moveElementRef.current?.(tipo, novaPosicao);
  }, []);

  const handleLayoutSelect = (comb: typeof COMBINACOES_ESPORTE[0]) => {
    setSelectedLayoutId(comb.id);
    moveElement('nome', comb.nome);
    moveElement('numero', comb.numero);
    moveElement('escudo', comb.escudo);
  };

  useEffect(() => {
    setUvLayers(prev => {
      const newLayers: UvLayer[] = [];
      const animatingLayerId = animatingElement?.layer?.id;
      
      const updateOrAddLayer = (id: string, zoneKey: string | null, content: string, type: 'text' | 'image', extra: Partial<UvLayer> = {}) => {
        if (!zoneKey) return;
        if (id === animatingLayerId) return; 

        const zone = uvMapZones[zoneKey];
        if (!zone) return;
        
        const baseFontSize = id.includes('nome') ? nomeSize : id.includes('numero') ? numeroSize : fontSize;
        const calculatedFontSize = (baseFontSize / 100) * zone.height;
        
        const layerColor = id.includes('nome') ? nomeColor : 
                          (id.includes('numero') && zoneKey.startsWith('peito')) ? numeroFrontColor :
                          (id.includes('numero') && zoneKey.startsWith('costas')) ? numeroBackColor : textColor;
        
        const layerFont = id.includes('nome') ? nomeFont : id.includes('numero') ? numeroFont : fontFamily;
        
        const layer: UvLayer = {
          id,
          zoneKey,
          type,
          content,
          color: layerColor,
          fontFamily: layerFont,
          fontSize: calculatedFontSize,
          fontWeight: 900,
          ...extra
        } as UvLayer;

        newLayers.push(layer);
      };

      if (showNome && elementPositions.nome) {
        const nomeContent = uvTextDrafts['nome'] || 'SEU NOME';
        updateOrAddLayer('layer_nome', elementPositions.nome, nomeContent, 'text', {
          strokeColor: nomeBorderColor !== 'transparent' ? nomeBorderColor : undefined,
          strokeWidth: nomeBorderColor !== 'transparent' ? 2 : 0
        });
      }
      
      if (showNumero && elementPositions.numero) {
        const numeroContent = uvTextDrafts['numero'] || '10';
        updateOrAddLayer('layer_numero', elementPositions.numero, numeroContent, 'text', {
          strokeColor: numeroFrontBorderColor !== 'transparent' ? numeroFrontBorderColor : undefined,
          strokeWidth: numeroFrontBorderColor !== 'transparent' ? 2 : 0
        });
        
        // Se o número estiver em uma posição de peito, também pode precisar estar nas costas se o layout for misto? 
        if (!elementPositions.numero.startsWith('costas')) {
             updateOrAddLayer('layer_numero_back', 'costas_centro', numeroContent, 'text', {
               strokeColor: numeroBackBorderColor !== 'transparent' ? numeroBackBorderColor : undefined,
               strokeWidth: numeroBackBorderColor !== 'transparent' ? 2 : 0
             });
        }
      }

      const defaultShieldSvg = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#cccccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>')}`;
      if (elementPositions.escudo) {
        updateOrAddLayer('layer_escudo', elementPositions.escudo, '', 'image', { 
          url: escudoImageUrl || defaultShieldSvg, 
          scale: debouncedEscudoScale, 
          offsetX: debouncedEscudoOffsetX,
          offsetY: debouncedEscudoOffsetY,
          opacity: 1 
        } as any);
      }

      // Sempre adiciona a camada da estampa, priorizando o UV map se disponível
      const stampUrl = appliedStamp?.uvMapUrl || appliedStamp?.imageUrl;
      if (stampUrl) {
        updateOrAddLayer('applied_stamp_main', 'full_canvas', '', 'image', {
          url: stampUrl,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
          opacity: 1
        } as any);
      }

      Object.keys(uvTextDrafts).forEach(k => {
        if (['nome', 'numero'].includes(k)) return;
        const content = uvTextDrafts[k];
        if (content) updateOrAddLayer(`free_${k}`, k, content, 'text');
      });

      return newLayers;
    });
  }, [elementPositions, uvMapZones, textColor, fontSize, fontFamily, uvTextDrafts, animatingElement?.layer?.id, showNome, showNumero, nomeColor, nomeSize, nomeFont, nomeBorderColor, numeroFrontColor, numeroBackColor, numeroSize, numeroFont, numeroFrontBorderColor, numeroBackBorderColor, escudoImageUrl, debouncedEscudoScale, debouncedEscudoOffsetX, debouncedEscudoOffsetY, appliedStamp]);

  const activeUvBaseUrl = appliedStamp?.uvMapUrl || selectedTemplate?.uvMapUrl || fallbackUvUrl || null;

  const uvComposite = useUvCompositor({
    baseUrl: activeUvBaseUrl ? toProxyUrl(activeUvBaseUrl) : null,
    zones: uvMapZones,
    layers: uvLayers,
    uvWidth: uvMapDims.w,
    uvHeight: uvMapDims.h,
  });

  useEffect(() => {
    if (uvComposite.canvas) {
      setUv3DCanvas(uvComposite.canvas);
      setUvTextureVersion(v => v + 1);
    }
  }, [uvComposite.version, uvComposite.ready]);

  // Limpa canvas quando estampa muda para evitar mostrar textura antiga
  useEffect(() => {
    setUv3DCanvas(null);
    setUvTextureVersion(v => v + 1);
  }, [appliedStamp?.id, selectedTemplate?.id]);

  const addStamp = (stamp: Stamp) => {
    setAppliedStamp(stamp);
  };

  const setUvLayerText = (zoneKey: string, content: string) => {
    setUvTextDrafts(prev => ({ ...prev, [zoneKey]: content }));
    if (uvTextCommitTimerRef.current != null) window.clearTimeout(uvTextCommitTimerRef.current);
    uvTextCommitTimerRef.current = window.setTimeout(() => {
      uvTextCommitTimerRef.current = null;
      setUvLayers(prev => {
        const existing = prev.find(l => l.zoneKey === zoneKey && l.type === 'text');
        const zone = uvMapZones[zoneKey];
        // Calculate relative font size based on percentage (1-100) and zone height
        const calculatedFontSize = zone ? (fontSize / 100) * zone.height : undefined;
        
        if (existing) {
          if (!content) return prev.filter(l => l !== existing);
          return prev.map(l => l === existing ? { ...l, content, color: textColor, fontFamily, fontSize: calculatedFontSize, fontWeight: 900 } as UvLayer : l);
        }
        if (!content) return prev;
        return [...prev, { id: `${zoneKey}_${Date.now()}`, zoneKey, type: 'text', content, color: textColor, fontFamily, fontSize: calculatedFontSize, fontWeight: 900 }];
      });
    }, 180);
  };

  const setUvLayerImage = (zoneKey: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      if (!url) return;
      setUvLayers(prev => [
        ...prev.filter(l => !(l.zoneKey === zoneKey && l.type === 'image')),
        { id: `${zoneKey}_image_${Date.now()}`, zoneKey, type: 'image', url, scale: 0.9, opacity: 1 } as UvLayer,
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleWhatsAppQuote = () => toast.info('Redirecionando para WhatsApp...');
  const handleDownload = () => toast.info('Gerando arquivos para download...');

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#FF5A00] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando Simulador...</p>
        </div>
      </div>
    );
  }

  if (!selectedTemplate) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center text-gray-800 uppercase tracking-widest">Escolha o seu modelo</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {templates.map(t => (
              <button key={t.id} onClick={() => setSelectedTemplate(t)} className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all">
                <div className="p-4"><img src={toProxyUrl(t.frontImageUrl)} className="w-full aspect-[3/4] object-contain rounded-xl bg-gray-50" /></div>
                <div className="p-4 border-t border-gray-50 bg-gray-50/50">
                  <p className="font-bold text-gray-700 truncate">{t.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <header className="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)} className="text-gray-400 hover:text-gray-900"><ChevronLeft className="w-5 h-5" /></Button>
          <img src={logo} alt="Jumptec" className="h-6 w-auto" />
          <div className="h-4 w-px bg-gray-200 mx-2" />
          <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">{selectedTemplate.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Modo: 3D Simulator v2</span>
        </div>
      </header>

      {/* PARTE 1 — Barra de nichos no topo */}
      <div id="nav-nichos" className="h-[100px] bg-[#FF5A00] flex items-center px-4 relative shrink-0 z-40">
        <button className="absolute left-2 z-10 p-2 text-white/50 hover:text-white transition-colors">
          <ChevronLeft className="w-8 h-8" />
        </button>
        
        <ul className="flex-1 flex items-center justify-start gap-6 px-10 overflow-x-auto no-scrollbar scroll-smooth h-full">
          {niches.map(nicho => (
            <li key={nicho.id} className="flex-shrink-0">
              <button
                onClick={() => handleNichoChange(nicho.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-[70px] h-[70px] rounded-full transition-all border-2",
                  nichoAtivo === nicho.id 
                    ? "bg-white text-[#FF5A00] border-[#FF5A00] scale-110 shadow-lg" 
                    : "bg-transparent text-white border-transparent hover:border-white/30"
                )}
              >
                <span className="text-2xl leading-none">{nicho.icon}</span>
                <span className="text-[9px] font-black uppercase tracking-tighter">{nicho.name}</span>
              </button>
            </li>
          ))}
        </ul>

        <button className="absolute right-2 z-10 p-2 text-white/50 hover:text-white transition-colors">
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

      {/* PARTE 4 — Miniaturas de estampas no topo */}
      <div id="faixa-estampas" className="h-20 bg-gray-50 border-b border-gray-100 flex items-center px-4 overflow-x-auto no-scrollbar shrink-0 z-40">
        <div className="flex gap-3 px-2">
          {stampsFiltrados.map(s => (
            <button
              key={s.id}
              onClick={() => addStamp(s)}
              className={cn(
                "w-14 h-14 rounded-lg bg-white border-2 overflow-hidden transition-all flex-shrink-0",
                appliedStamp?.id === s.id ? "border-[#FF5A00] scale-105 shadow-md" : "border-gray-100 hover:border-gray-200"
              )}
            >
              <img src={toProxyUrl(s.imageUrl)} alt={s.name} className="w-full h-full object-contain p-1" />
            </button>
          ))}
        </div>
      </div>

      <main className="flex flex-1 overflow-hidden h-[calc(100vh-17.5rem)]">
        {/* Coluna 1: Sidebar de Navegação */}
        <nav id="left-sidebar" className="w-14 lg:w-20 bg-white border-r border-gray-100 flex-shrink-0 flex flex-col items-center py-6 space-y-6 lg:space-y-8 z-30 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)]">
          {[
            { id: 'stamps', label: 'Estampa', icon: Shirt, show: true },
            { id: 'text', label: 'Texto', icon: Type, show: true },
            { id: 'name', label: regrasAtuais.labelNome, icon: Hand, show: regrasAtuais.temNome },
            { id: 'patches', label: 'Acabamento', icon: Sparkles, show: true },
            { id: 'emblems', label: regrasAtuais.labelEscudo, icon: ImageIcon, show: regrasAtuais.temEscudo },
            { id: 'logo', label: 'Número', icon: Box, show: regrasAtuais.temNumero },
            { id: 'upload_generic', label: 'Upload', icon: Upload, show: true },
          ].filter(item => item.show).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as ToolbarTab)}
              className={`flex flex-col items-center gap-1 w-full py-2 transition-all relative ${activeTab === id ? 'text-[#FF5A00]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {activeTab === id && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#FF5A00] rounded-l-full" />}
              <Icon className={cn("w-5 h-5 lg:w-6 lg:h-6", activeTab === id ? "animate-in zoom-in-50 duration-300" : "")} />
              <span className="text-[7px] lg:text-[9px] font-black uppercase tracking-tighter text-center px-1">{label}</span>
            </button>
          ))}
        </nav>

        {/* Coluna 2: Painel Dinâmico */}
        <div id="dynamicSidebar" className="w-48 md:w-64 lg:w-80 bg-white border-r border-gray-100 flex-shrink-0 overflow-y-auto z-20 shadow-[10px_0_30px_-5px_rgba(0,0,0,0.02)]">
          <div className="p-4 lg:p-6">
            <h2 className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 lg:mb-6">
              Configurações de {
                activeTab === 'stamps' ? 'Estampa' : 
                activeTab === 'text' ? 'Texto' : 
                activeTab === 'name' ? regrasAtuais.labelNome + '/Número' : 
                activeTab === 'patches' ? 'Acabamento' : 
                activeTab === 'emblems' ? regrasAtuais.labelEscudo : 
                activeTab === 'logo' ? 'Número' : 'Upload'
              }
            </h2>
            
            <div className="space-y-4 lg:space-y-6">
              {activeTab !== 'stamps' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-3 p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex flex-col gap-1 p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <label className="text-[7px] lg:text-[8px] font-black text-gray-400 uppercase">Cor Principal</label>
                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-5 lg:h-6 w-full rounded cursor-pointer border-none" />
                  </div>
                  <div className="flex flex-col gap-1 p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <label className="text-[7px] lg:text-[8px] font-black text-gray-400 uppercase">Tamanho</label>
                    <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="h-5 lg:h-6 border-none bg-transparent font-bold text-[10px] lg:text-xs p-0 focus-visible:ring-0" />
                  </div>
                </div>
              )}

              {activeTab === 'stamps' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  {appliedStamp && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-white rounded-xl border border-gray-100 p-1">
                          <img src={toProxyUrl(appliedStamp.imageUrl)} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-gray-800 uppercase leading-tight">{appliedStamp.name}</p>
                          <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">Estampa Selecionada</p>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full h-10 text-[9px] font-black uppercase tracking-widest border-2 border-gray-200 hover:border-[#FF5A00] hover:text-[#FF5A00] transition-all">
                        Ver todas as estampas
                      </Button>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
                    {stampsFiltrados.slice(0, 6).map(s => (
                      <button
                        key={s.id}
                        onClick={() => addStamp(s)}
                        className={`group rounded-xl lg:rounded-2xl border-2 overflow-hidden transition-all aspect-square relative ${appliedStamp?.id === s.id ? 'border-[#FF5A00] bg-[#FF5A00]/5' : 'border-gray-50 hover:border-gray-200'}`}
                      >
                        <StampThumb stampUrl={s.imageUrl} name={s.name} />
                        <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-sm p-1 text-center">
                          <p className="text-[7px] lg:text-[8px] font-black uppercase text-gray-500 truncate px-1">{s.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab === 'text' || activeTab === 'name' || activeTab === 'emblems' || activeTab === 'logo') && (
                <div className="space-y-4 lg:space-y-6">
                  {activeTab !== 'emblems' && (
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger className="w-full h-10 lg:h-12 rounded-xl bg-gray-50 border-gray-100 shadow-sm font-bold text-[10px] lg:text-xs"><SelectValue placeholder="Fonte" /></SelectTrigger>
                      <SelectContent>{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent>
                    </Select>
                  )}
                  
                  {activeTab === 'name' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                      {/* 1. TOGGLES NO TOPO */}
                      <div className="flex gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                            showNome ? "bg-[#FF5A00] border-[#FF5A00]" : "border-gray-300 group-hover:border-gray-400"
                          )}>
                            <input type="checkbox" className="hidden" checked={showNome} onChange={e => setShowNome(e.target.checked)} />
                            {showNome && <X className="w-3.5 h-3.5 text-white rotate-45" />}
                          </div>
                          <span className={cn("text-[11px] font-black uppercase tracking-wider", showNome ? "text-gray-900" : "text-gray-400")}>{regrasAtuais.labelNome}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                            showNumero ? "bg-[#FF5A00] border-[#FF5A00]" : "border-gray-300 group-hover:border-gray-400"
                          )}>
                            <input type="checkbox" className="hidden" checked={showNumero} onChange={e => setShowNumero(e.target.checked)} />
                            {showNumero && <X className="w-3.5 h-3.5 text-white rotate-45" />}
                          </div>
                          <span className={cn("text-[11px] font-black uppercase tracking-wider", showNumero ? "text-gray-900" : "text-gray-400")}>Número</span>
                        </label>
                      </div>

                      {/* 2. SELETOR DE POSIÇÃO DO NOME */}
                      {showNome && (
                        <div className="space-y-4">
                          <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-[0.2em]">Posição do {regrasAtuais.labelNome}</h3>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: 'costas_topo', label: 'Topo' },
                              { id: 'costas_fundo', label: 'Fundo' }
                            ].map(pos => (
                              <button
                                key={pos.id}
                                onClick={() => moveElement('nome', pos.id)}
                                style={{ 
                                  '--shirt-color': elementPositions.nome === pos.id ? "#FF5A00" : "#d1d5db"
                                } as React.CSSProperties}
                                className={cn(
                                  "relative min-w-[85px] p-2 rounded-[12px] border-2 transition-all flex flex-col items-center gap-2 cursor-pointer",
                                  elementPositions.nome === pos.id 
                                    ? "border-[#FF5A00] bg-[rgba(255,90,0,0.08)]" 
                                    : "border-gray-100 bg-white"
                                )}
                              >
                                <svg viewBox="0 0 71.6 58.5" width="80" height="70" style={{ shapeRendering: 'geometricPrecision' }}>
                                  <path fill="var(--shirt-color)" d="M55.4,58.5H16.2V23.7l-7.1,4L0,13.1L14.9,3l13-3L28,0c2.6,0.7,5.3,1,7.9,1c2.6,0,5.2-0.3,7.7-1l0.2,0l13,3l14.9,10.2l-9.1,14.5l-7.1-4V58.5z M17.6,57H54V21.2l8.1,4.5l7.6-12.2L56.1,4.3L43.8,1.5c-2.6,0.6-5.2,1-7.9,1c-2.7,0-5.4-0.3-8.1-1L15.5,4.3L1.9,13.5l7.6,12.2l8.1-4.5V57z"/>
                                  {pos.id === 'costas_topo' ? (
                                    <>
                                      <text x="35.8" y="18" textAnchor="middle" fontSize="7" fontWeight="900" fill="var(--shirt-color)">{regrasAtuais.labelNome.toUpperCase()}</text>
                                      <text x="35.8" y="42" textAnchor="middle" fontSize="12" fontWeight="900" fill="var(--shirt-color)">10</text>
                                    </>
                                  ) : (
                                    <>
                                      <text x="35.8" y="28" textAnchor="middle" fontSize="12" fontWeight="900" fill="var(--shirt-color)">10</text>
                                      <text x="35.8" y="50" textAnchor="middle" fontSize="7" fontWeight="900" fill="var(--shirt-color)">{regrasAtuais.labelNome.toUpperCase()}</text>
                                    </>
                                  )}
                                </svg>
                                <span className="text-[9px] font-black uppercase">{pos.label}</span>
                                {elementPositions.nome === pos.id && (
                                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#22c55e] rounded-full flex items-center justify-center shadow-sm">
                                    <Check className="w-3 h-3 text-white stroke-[4]" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. SELETOR DE POSIÇÃO DO NÚMERO */}
                      {showNumero && (
                        <div className="space-y-4">
                          <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-[0.2em]">Posição do Número</h3>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: 'peito_centro', label: 'Centro' },
                              { id: 'peito_direito', label: 'Direito' },
                              { id: 'peito_esquerdo', label: 'Esquerdo' }
                            ].map(pos => (
                              <button
                                key={pos.id}
                                onClick={() => moveElement('numero', pos.id)}
                                style={{ 
                                  '--shirt-color': elementPositions.numero === pos.id ? "#FF5A00" : "#d1d5db"
                                } as React.CSSProperties}
                                className={cn(
                                  "relative min-w-[85px] p-2 rounded-[12px] border-2 transition-all flex flex-col items-center gap-2 cursor-pointer",
                                  elementPositions.numero === pos.id 
                                    ? "border-[#FF5A00] bg-[rgba(255,90,0,0.08)]" 
                                    : "border-gray-100 bg-white"
                                )}
                              >
                                <svg viewBox="0 0 72.5 59.5" width="80" height="70" style={{ shapeRendering: 'geometricPrecision' }}>
                                  <path fill="var(--shirt-color)" d="M56.1,59.5H16.4V24.2l-7.2,4.1L0,13.4L15.1,3.1L28.5,0l0.3,0.4c1.7,2.6,4.5,4,7.5,4.1h0c2.9,0,5.7-1.5,7.4-4.1L44,0l13.4,3.1l15.1,10.3l-9.2,14.8l-7.2-4.1V59.5z M17.9,58h36.7V21.6l8.2,4.6l7.7-12.4L56.8,4.5L44.6,1.7c-2,2.7-5.1,4.3-8.4,4.3h-0.1c-3.3,0-6.3-1.6-8.4-4.3L15.7,4.5L2,13.9l7.7,12.4l8.2-4.6V58z"/>
                                  <text 
                                    x={pos.id === 'peito_centro' ? '36.2' : pos.id === 'peito_direito' ? '25' : '48'} 
                                    y={pos.id === 'peito_centro' ? '38' : '28'} 
                                    fill="var(--shirt-color)" 
                                    fontSize={pos.id === 'peito_centro' ? '12' : '9'} 
                                    fontWeight="900" 
                                    textAnchor="middle"
                                  >
                                    10
                                  </text>
                                </svg>
                                <span className="text-[9px] font-black uppercase">{pos.label}</span>
                                {elementPositions.numero === pos.id && (
                                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#22c55e] rounded-full flex items-center justify-center shadow-sm">
                                    <Check className="w-3 h-3 text-white stroke-[4]" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 4. SEÇÃO PERSONALIZAR NOME */}
                      {showNome && (
                        <div className="space-y-6 pt-6 border-t border-gray-100">
                          <div className="flex flex-col gap-1">
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Personalizar nome</h3>
                          </div>
                          
                          <div className="space-y-4">
                            <Input
                              value={uvTextDrafts['nome'] ?? ''}
                              onChange={(e) => setUvLayerText('nome', e.target.value)}
                              placeholder="Digite seu nome aqui"
                              maxLength={16}
                              className="h-12 bg-gray-50 border-none rounded-xl font-bold text-xs focus-visible:ring-1 focus-visible:ring-[#FF5A00]/20"
                            />

                            <Select value={nomeFont} onValueChange={setNomeFont}>
                              <SelectTrigger className="h-12 bg-gray-50 border-none rounded-xl font-bold text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent>
                            </Select>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                               <span className="text-[10px] font-black uppercase text-gray-400">Tamanho</span>
                               <div className="flex items-center gap-3">
                                 <button onClick={() => setNomeSize(s => Math.max(10, s - 5))} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-gray-400 hover:text-[#FF5A00]">-</button>
                                 <span className="text-xs font-black w-6 text-center">{nomeSize}</span>
                                 <button onClick={() => setNomeSize(s => Math.min(200, s + 5))} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-gray-400 hover:text-[#FF5A00]">+</button>
                               </div>
                            </div>

                            <div className="space-y-3">
                              <span className="text-[10px] font-black uppercase text-gray-400">Cor do nome</span>
                              <div className="grid grid-cols-8 gap-2">
                                {COLORS.map(c => (
                                  <button
                                    key={c.hex}
                                    title={c.name}
                                    onClick={() => setNomeColor(c.hex)}
                                    className={cn(
                                      "w-6 h-6 rounded-full border transition-all",
                                      nomeColor === c.hex ? "ring-2 ring-gray-800 border-white scale-110" : "border-gray-200"
                                    )}
                                    style={{ backgroundColor: c.hex }}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <span className="text-[10px] font-black uppercase text-gray-400">Cor da borda</span>
                              <div className="grid grid-cols-8 gap-2">
                                <button
                                  onClick={() => setNomeBorderColor('transparent')}
                                  className={cn(
                                    "w-6 h-6 rounded-full border flex items-center justify-center bg-white transition-all",
                                    nomeBorderColor === 'transparent' ? "ring-2 ring-gray-800 border-white" : "border-gray-200"
                                  )}
                                >
                                  <X className="w-3 h-3 text-red-500" />
                                </button>
                                {COLORS.map(c => (
                                  <button
                                    key={c.hex}
                                    title={c.name}
                                    onClick={() => setNomeBorderColor(c.hex)}
                                    className={cn(
                                      "w-6 h-6 rounded-full border transition-all",
                                      nomeBorderColor === c.hex ? "ring-2 ring-gray-800 border-white scale-110" : "border-gray-200"
                                    )}
                                    style={{ backgroundColor: c.hex }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 5. SEÇÃO PERSONALIZAR NÚMERO */}
                      {showNumero && (
                        <div className="space-y-6 pt-6 border-t border-gray-100">
                          <div className="flex flex-col gap-1">
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Personalizar número</h3>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="flex-1 p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                                <button onClick={() => {
                                  const cur = parseInt(uvTextDrafts['numero'] || '10');
                                  setUvLayerText('numero', Math.max(0, cur - 1).toString());
                                }} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-gray-400 hover:text-[#FF5A00]">-</button>
                                <Input
                                  value={uvTextDrafts['numero'] ?? '10'}
                                  onChange={(e) => setUvLayerText('numero', e.target.value)}
                                  className="w-12 h-8 bg-transparent border-none text-center font-black p-0 focus-visible:ring-0"
                                />
                                <button onClick={() => {
                                  const cur = parseInt(uvTextDrafts['numero'] || '10');
                                  setUvLayerText('numero', (cur + 1).toString());
                                }} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-gray-400 hover:text-[#FF5A00]">+</button>
                              </div>
                              <Select value={numeroFont} onValueChange={setNumeroFont}>
                                <SelectTrigger className="flex-1 h-12 bg-gray-50 border-none rounded-xl font-bold text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                               <span className="text-[10px] font-black uppercase text-gray-400">Tamanho</span>
                               <div className="flex items-center gap-3">
                                 <button onClick={() => setNumeroSize(s => Math.max(10, s - 5))} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-gray-400 hover:text-[#FF5A00]">-</button>
                                 <span className="text-xs font-black w-6 text-center">{numeroSize}</span>
                                 <button onClick={() => setNumeroSize(s => Math.min(200, s + 5))} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-gray-400 hover:text-[#FF5A00]">+</button>
                               </div>
                            </div>

                            {/* Cores Número Frente */}
                            <div className="space-y-4 pt-2">
                              <div className="space-y-3">
                                <span className="text-[10px] font-black uppercase text-gray-400">Cor Número Frente</span>
                                <div className="grid grid-cols-8 gap-2">
                                  {COLORS.map(c => (
                                    <button key={c.hex} title={c.name} onClick={() => setNumeroFrontColor(c.hex)}
                                      className={cn("w-6 h-6 rounded-full border transition-all", numeroFrontColor === c.hex ? "ring-2 ring-gray-800 border-white scale-110" : "border-gray-200")}
                                      style={{ backgroundColor: c.hex }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-3">
                                <span className="text-[10px] font-black uppercase text-gray-400">Cor Borda Frente</span>
                                <div className="grid grid-cols-8 gap-2">
                                  <button onClick={() => setNumeroFrontBorderColor('transparent')}
                                    className={cn("w-6 h-6 rounded-full border flex items-center justify-center bg-white transition-all", numeroFrontBorderColor === 'transparent' ? "ring-2 ring-gray-800 border-white" : "border-gray-200")}
                                  >
                                    <X className="w-3 h-3 text-red-500" />
                                  </button>
                                  {COLORS.map(c => (
                                    <button key={c.hex} title={c.name} onClick={() => setNumeroFrontBorderColor(c.hex)}
                                      className={cn("w-6 h-6 rounded-full border transition-all", numeroFrontBorderColor === c.hex ? "ring-2 ring-gray-800 border-white scale-110" : "border-gray-200")}
                                      style={{ backgroundColor: c.hex }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Cores Número Verso */}
                            <div className="space-y-4 pt-4 border-t border-gray-50">
                              <div className="space-y-3">
                                <span className="text-[10px] font-black uppercase text-gray-400">Cor Número Verso</span>
                                <div className="grid grid-cols-8 gap-2">
                                  {COLORS.map(c => (
                                    <button key={c.hex} title={c.name} onClick={() => setNumeroBackColor(c.hex)}
                                      className={cn("w-6 h-6 rounded-full border transition-all", numeroBackColor === c.hex ? "ring-2 ring-gray-800 border-white scale-110" : "border-gray-200")}
                                      style={{ backgroundColor: c.hex }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-3">
                                <span className="text-[10px] font-black uppercase text-gray-400">Cor Borda Verso</span>
                                <div className="grid grid-cols-8 gap-2">
                                  <button onClick={() => setNumeroBackBorderColor('transparent')}
                                    className={cn("w-6 h-6 rounded-full border flex items-center justify-center bg-white transition-all", numeroBackBorderColor === 'transparent' ? "ring-2 ring-gray-800 border-white" : "border-gray-200")}
                                  >
                                    <X className="w-3 h-3 text-red-500" />
                                  </button>
                                  {COLORS.map(c => (
                                    <button key={c.hex} title={c.name} onClick={() => setNumeroBackBorderColor(c.hex)}
                                      className={cn("w-6 h-6 rounded-full border transition-all", numeroBackBorderColor === c.hex ? "ring-2 ring-gray-800 border-white scale-110" : "border-gray-200")}
                                      style={{ backgroundColor: c.hex }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'emblems' && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{regrasAtuais.labelEscudo}</h3>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Escolha a posição</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Peito Direito', id: 'peito_direito' },
                            { label: 'Peito Esquerdo', id: 'peito_esquerdo' }
                          ].map(pos => (
                            <button
                              key={pos.id}
                              type="button"
                              data-pos-id={pos.id}
                              data-tipo="escudo"
                              onClick={() => moveElement('escudo', pos.id)}
                              className={cn(
                                "h-10 text-[8px] font-bold uppercase rounded-lg border transition-all",
                                elementPositions.escudo === pos.id 
                                  ? "bg-[#FF5A00] text-white border-[#FF5A00] shadow-sm" 
                                  : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                              )}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Logo Personalizado</p>
                        </div>

                        {!escudoImageUrl ? (
                          <div 
                            onClick={() => document.getElementById('escudo-upload')?.click()}
                            className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#FF5A00]/50 hover:bg-[#FF5A00]/5 transition-all group"
                          >
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-[#FF5A00]/10 transition-colors">
                              <Upload className="w-5 h-5 text-gray-400 group-hover:text-[#FF5A00]" />
                            </div>
                            <div className="text-center">
                              <p className="text-[11px] font-bold text-gray-700">Clique para enviar seu {regrasAtuais.labelEscudo.toLowerCase()}</p>
                              <p className="text-[9px] text-gray-400 font-medium">JPG, PNG, SVG ou PDF • Máx 10MB</p>
                            </div>
                            <input 
                              id="escudo-upload"
                              type="file"
                              className="hidden"
                              accept="image/jpeg,image/png,image/svg+xml,application/pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleEscudoUpload(file);
                              }}
                            />
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                              <div className="w-16 h-16 bg-white rounded-lg border border-gray-100 p-1 flex items-center justify-center overflow-hidden">
                                <img src={escudoImageUrl} alt="Preview" className="w-full h-full object-contain" />
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black text-gray-800 uppercase">{regrasAtuais.labelEscudo} Carregado</p>
                                <button 
                                  onClick={() => {
                                    setEscudoImageUrl(null);
                                    setEscudoScale(1);
                                    setEscudoOffsetX(0);
                                    setEscudoOffsetY(0);
                                  }}
                                  className="text-[9px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1 mt-1 uppercase"
                                >
                                  <X className="w-3 h-3" /> Remover
                                </button>
                              </div>
                            </div>

                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tamanho</label>
                                    <span className="text-[10px] font-bold text-gray-700">{Math.round(escudoScale * 100)}%</span>
                                  </div>
                                  <Slider 
                                    value={[escudoScale * 100]} 
                                    min={50} 
                                    max={300} 
                                    step={1} 
                                    onValueChange={([v]) => setEscudoScale(v / 100)}
                                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-[#FF5A00] [&_[role=slider]]:bg-white"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ajuste Vertical</label>
                                    <span className="text-[10px] font-bold text-gray-700">{escudoOffsetY}</span>
                                  </div>
                                  <Slider 
                                    value={[escudoOffsetY]} 
                                    min={-300} 
                                    max={300} 
                                    step={1} 
                                    onValueChange={([v]) => setEscudoOffsetY(v)}
                                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-[#FF5A00] [&_[role=slider]]:bg-white"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ajuste Horizontal</label>
                                    <span className="text-[10px] font-bold text-gray-700">{escudoOffsetX}</span>
                                  </div>
                                  <Slider 
                                    value={[escudoOffsetX]} 
                                    min={-300} 
                                    max={300} 
                                    step={1} 
                                    onValueChange={([v]) => setEscudoOffsetX(v)}
                                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-[#FF5A00] [&_[role=slider]]:bg-white"
                                  />
                                </div>
                              </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'text' && (
                    <div className="space-y-4">
                      {Object.keys(uvMapZones).filter(k => !['peito_direito', 'peito_esquerdo', 'peito_centro', 'costas_topo', 'costas_centro', 'costas_fundo', 'manga_esquerda', 'manga_direita'].includes(k)).map((zoneKey) => (
                        <div key={zoneKey} className="p-3 lg:p-4 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-2 lg:space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] lg:text-[9px] font-black text-[#FF5A00] uppercase tracking-widest">{zoneKey}</span>
                            <div className="flex gap-1">
                               <button onClick={() => document.getElementById(`uv-file-${zoneKey}`)?.click()} className="p-1 hover:bg-gray-50 rounded-lg text-gray-400"><Upload className="w-3 lg:w-3.5 h-3 lg:h-3.5" /></button>
                               <button onClick={() => setUvLayerText(zoneKey, '')} className="p-1 hover:bg-gray-50 rounded-lg text-gray-400"><Trash2 className="w-3 lg:w-3.5 h-3 lg:h-3.5" /></button>
                            </div>
                          </div>
                          <Input
                            value={uvTextDrafts[zoneKey] ?? ''}
                            onChange={(e) => setUvLayerText(zoneKey, e.target.value)}
                            placeholder={`Digite aqui...`}
                            className="h-8 lg:h-10 bg-gray-50 border-none rounded-xl font-medium text-[10px] lg:text-xs focus-visible:ring-1 focus-visible:ring-[#FF5A00]/20"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'logo' && (
                    <div className="grid grid-cols-2 gap-2">
                       {['peito_centro', 'manga_esquerda', 'manga_direita'].map(zoneKey => (
                         <div key={zoneKey} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                           <span className="text-[8px] font-black text-gray-400 uppercase text-center">{zoneKey.replace('_', ' ')}</span>
                           <Button 
                             variant="outline" 
                             size="sm" 
                             className="h-12 bg-white border-none shadow-sm hover:bg-gray-100 flex flex-col gap-1"
                             onClick={() => document.getElementById(`uv-file-${zoneKey}`)?.click()}
                           >
                             <Upload className="w-3 h-3" />
                             <span className="text-[7px]">UPLOAD</span>
                           </Button>
                           <input id={`uv-file-${zoneKey}`} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setUvLayerImage(zoneKey, file); }} />
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 lg:pt-6 border-t border-gray-50">
                <Button variant="ghost" size="sm" onClick={() => { setAppliedStamp(null); setUvLayers([]); setUvTextDrafts({}); }} className="w-full text-[8px] lg:text-[9px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest">
                  <RotateCcw className="w-3 lg:w-3.5 h-3 lg:h-3.5 mr-2" /> Resetar Design
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 3: Canvas 3D */}
        <div className="flex-1 relative bg-[#F8F9FA] flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            <Shirt3DPreview 
              frontImage={selectedTemplate?.frontImageUrl || ''} 
              backImage={selectedTemplate?.backImageUrl || ''} 
              uvMapUrl={appliedStamp?.uvMapUrl || selectedTemplate?.uvMapUrl || null}
              uvCanvas={uv3DCanvas}
              uvVersion={uvTextureVersion}
              animatingElement={animatingElement}
              onAnimationComplete={() => setAnimatingElement(null)}
              cameraPosition={cameraPosition}
              autoRotate={false}
              fabricColor={appliedStamp ? '#ffffff' : '#cccccc'}
              isUvReady={uvComposite.ready}
              className={cn("transition-opacity duration-300")}
            />
            
            {/* Overlay Actions */}
            <div className="absolute top-4 lg:top-6 right-4 lg:right-6 flex gap-2 lg:gap-3 z-30">
              <Button onClick={handleWhatsAppQuote} className="h-10 lg:h-12 px-4 lg:px-8 bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white font-black rounded-xl lg:rounded-2xl shadow-[0_10px_20px_-5px_rgba(255,90,0,0.3)] text-[10px] lg:text-xs uppercase tracking-widest gap-2 animate-in slide-in-from-top duration-500">
                 Orçamento <ChevronLeft className="w-3 h-3 lg:w-4 lg:h-4 rotate-180" />
              </Button>
              <Button onClick={handleDownload} variant="outline" className="h-10 lg:h-12 px-3 lg:px-6 bg-white border-none shadow-xl text-gray-700 font-bold rounded-xl lg:rounded-2xl hover:bg-gray-50 text-[10px] lg:text-xs uppercase tracking-wider">
                 <Download className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </Button>
            </div>

            <button 
              className="absolute top-4 lg:top-6 left-4 lg:left-6 p-3 lg:p-4 bg-white hover:bg-gray-50 rounded-xl lg:rounded-2xl shadow-xl border border-gray-100 transition-all active:scale-95 group z-30" 
              onClick={() => setCameraPosition([0, 0.1, 5.2])}
            >
              <RotateCcw className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400 group-hover:text-[#FF5A00] transition-colors" />
            </button>

            {/* Visual View Selectors */}
            <div className="absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 lg:gap-4 z-30">
               <button onClick={() => setCameraPosition([0, 0.1, 5.2])} className={cn("w-10 h-10 lg:w-14 lg:h-14 bg-white rounded-xl lg:rounded-2xl shadow-xl flex items-center justify-center hover:bg-gray-50 transition-all border-2", cameraPosition[2] > 0 ? "border-[#FF5A00]/50" : "border-gray-100")}><Shirt className={cn("w-5 h-5 lg:w-7 lg:h-7", cameraPosition[2] > 0 ? "text-[#FF5A00]" : "text-gray-300")} /></button>
               <button onClick={() => setCameraPosition([0, 0.1, -5.2])} className={cn("w-10 h-10 lg:w-14 lg:h-14 bg-white rounded-xl lg:rounded-2xl shadow-xl flex items-center justify-center hover:bg-gray-50 transition-all border-2", cameraPosition[2] < 0 ? "border-[#FF5A00]/50" : "border-gray-100")}><Shirt className={cn("w-5 h-5 lg:w-7 lg:h-7 rotate-180", cameraPosition[2] < 0 ? "text-[#FF5A00]" : "text-gray-300")} /></button>
            </div>
          </div>
          
          <div className="h-10 lg:h-12 bg-white/50 backdrop-blur-sm border-t border-gray-100 flex items-center justify-center gap-4 lg:gap-8 px-4 lg:px-6 shrink-0">
             <div className="flex items-center gap-1 lg:gap-2"><div className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-[8px] lg:text-[10px] font-black text-gray-500 uppercase tracking-widest">3D Ativo</span></div>
             <div className="flex items-center gap-1 lg:gap-2"><div className="w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full bg-[#FF5A00]" /><span className="text-[8px] lg:text-[10px] font-black text-gray-500 uppercase tracking-widest">Sincronização Realtime</span></div>
          </div>
        </div>
      </main>

      {flyingElement && (
        <div
          style={{
            position: 'fixed',
            left: flyingElement.from.x,
            top: flyingElement.from.y,
            transform: `translate(${flyingElement.to.x - flyingElement.from.x}px, ${flyingElement.to.y - flyingElement.from.y}px)`,
            transition: 'transform 600ms ease-in-out',
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: '#FF5A00',
            padding: '4px 12px',
            borderRadius: '8px',
            pointerEvents: 'none',
            zIndex: 9999,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}
        >
          {flyingElement.content}
        </div>
      )}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default ShirtEditor;
