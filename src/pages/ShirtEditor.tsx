import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, FabricText, Textbox, FabricImage, Point, Polygon, FabricObject, Control, controlsUtils } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, Move, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt, Sparkles, X, Hand, Box, Palette, Lock } from 'lucide-react';
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
import { SvgAnalyzer, SvgColorGroup } from '@/lib/svgAnalyzer';
import { cmykToHex, hexToCmyk } from '@/lib/cmykEngine';

// Thumbnail: show only the 2D front image uploaded for the stamp.
// The UV is kept only for the 3D texture when the client clicks this stamp.
function StampThumb({ stampUrl, name }: { stampUrl: string; name: string }) {
  return (
    <img
      src={stampUrl}
      alt={name}
      loading="lazy"
      decoding="async"
      className="w-full aspect-square object-contain p-1 protected-img bg-muted/10"
    />
  );
}


const isLikelyStampCode = (name: string) => /^[A-Za-z]{0,6}[-_.]?\d{1,6}[A-Za-z]{0,3}$/i.test(name.trim());

const isMisplacedStampTemplate = (template: Template) =>
  isLikelyStampCode(template.name) && (
    /colorway/i.test(template.frontImageUrl) ||
    /colorway/i.test(template.backImageUrl)
  );

function Preview3DTabs({ front, back, uvMapUrl, cameraPosition, onCameraChange }: { front: string; back: string; uvMapUrl: string | null; cameraPosition: [number, number, number]; onCameraChange: (pos: [number, number, number]) => void }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 relative">
        <Shirt3DPreview 
          frontImage={front} 
          backImage={back} 
          uvMapUrl={uvMapUrl} 
          cameraPosition={cameraPosition}
          autoRotate={false}
        />
        
        {/* View Controls */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-[12px] z-10">
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center h-[88px] w-[64px] p-0 bg-white rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.08)] border-none relative overflow-hidden hover:translate-x-[2px] hover:scale-[1.03] hover:shadow-[0_12px_28px_rgba(79,123,255,0.05)] transition-all duration-200 group active:bg-[#F0F6FF]"
            onClick={() => onCameraChange([0, 0.1, 5.2])}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-[#4F7BFF] to-[#8EB8FF] rounded-l-[16px]" />
            <div className="mb-1 text-[#4F7BFF] transition-colors">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.62 1.96V10a6 6 0 003.1 5.25L12 22l6.9-6.75A6 6 0 0022 10V5.42a2 2 0 00-1.62-1.96z" />
                  <path d="M12 22v-6.5M12 7c-2 0-3 1-3 3M12 7c2 0 3 1 3 3" />
                </svg>
              </div>
            </div>
            <span className="text-[11px] font-bold uppercase text-[#1A1F2C] leading-[1.1] text-center px-1 whitespace-pre-line w-full">FRENTE</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center h-[88px] w-[64px] p-0 bg-white rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.08)] border-none relative overflow-hidden hover:translate-x-[2px] hover:scale-[1.03] hover:shadow-[0_12px_28px_rgba(79,123,255,0.05)] transition-all duration-200 group active:bg-[#F0F6FF]"
            onClick={() => onCameraChange([0, 0.1, -5.2])}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-[#4F7BFF] to-[#8EB8FF] rounded-l-[16px]" />
            <div className="mb-1 text-[#4F7BFF] transition-colors">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.62 1.96V10a6 6 0 003.1 5.25L12 22l6.9-6.75A6 6 0 0022 10V5.42a2 2 0 00-1.62-1.96z" />
                  <path d="M8 2h8M12 2v3M9 10h6M12 22v-6.5" />
                </svg>
              </div>
            </div>
            <span className="text-[11px] font-bold uppercase text-[#1A1F2C] leading-[1.1] text-center px-1 whitespace-pre-line w-full">COSTAS</span>
          </Button>

          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center h-[88px] w-[64px] p-0 bg-white rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.08)] border-none relative overflow-hidden hover:translate-x-[2px] hover:scale-[1.03] hover:shadow-[0_12px_28px_rgba(79,123,255,0.05)] transition-all duration-200 group active:bg-[#F0F6FF]"
            onClick={() => onCameraChange([-5.2, 0.1, 0])}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-[#4F7BFF] to-[#8EB8FF] rounded-l-[16px]" />
            <div className="mb-1 text-[#4F7BFF] transition-colors">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22L5 15.25A6 6 0 012 10V5.42a2 2 0 011.62-1.96L8 2M12 22v-6.5M8 2c.5 1 1 2 4 2M10 10c-1 0-2 1-2 2v4" />
                </svg>
              </div>
            </div>
            <span className="text-[11px] font-bold uppercase text-[#1A1F2C] leading-[1.1] text-center px-1 w-full flex flex-col items-center">
              <span>LATERAL</span>
              <span>ESQUERDA</span>
            </span>
          </Button>

          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center h-[88px] w-[64px] p-0 bg-white rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.08)] border-none relative overflow-hidden hover:translate-x-[2px] hover:scale-[1.03] hover:shadow-[0_12px_28px_rgba(79,123,255,0.05)] transition-all duration-200 group active:bg-[#F0F6FF]"
            onClick={() => onCameraChange([5.2, 0.1, 0])}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-[#4F7BFF] to-[#8EB8FF] rounded-l-[16px]" />
            <div className="mb-1 text-[#4F7BFF] transition-colors">
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}>
                  <path d="M12 22L5 15.25A6 6 0 012 10V5.42a2 2 0 011.62-1.96L8 2M12 22v-6.5M8 2c.5 1 1 2 4 2M10 10c-1 0-2 1-2 2v4" />
                </svg>
              </div>
            </div>
            <span className="text-[11px] font-bold uppercase text-[#1A1F2C] leading-[1.1] text-center px-1 w-full flex flex-col items-center">
              <span>LATERAL</span>
              <span>DIREITA</span>
            </span>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-1">Arraste para girar · Use a roda do mouse / pinça para dar zoom</p>
    </div>
  );
}


interface ShirtEditorProps {
  useOwnAssets?: boolean;
}

const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial', google: false },
  { label: 'Impact', value: 'Impact', google: false },
  { label: 'Georgia', value: 'Georgia', google: false },
  { label: 'Courier New', value: 'Courier New', google: false },
  { label: 'Comic Sans MS', value: 'Comic Sans MS', google: false },
  { label: 'Roboto', value: 'Roboto', google: true },
  { label: 'Open Sans', value: 'Open Sans', google: true },
  { label: 'Montserrat', value: 'Montserrat', google: true },
  { label: 'Oswald', value: 'Oswald', google: true },
  { label: 'Playfair Display', value: 'Playfair Display', google: true },
  { label: 'Bebas Neue', value: 'Bebas Neue', google: true },
  { label: 'Pacifico', value: 'Pacifico', google: true },
  { label: 'Lobster', value: 'Lobster', google: true },
  { label: 'Permanent Marker', value: 'Permanent Marker', google: true },
  { label: 'Dancing Script', value: 'Dancing Script', google: true },
  { label: 'Righteous', value: 'Righteous', google: true },
  { label: 'Bangers', value: 'Bangers', google: true },
  { label: 'Alfa Slab One', value: 'Alfa Slab One', google: true },
  { label: 'Anton', value: 'Anton', google: true },
  { label: 'Press Start 2P', value: 'Press Start 2P', google: true },
];

// Load Google Fonts on demand — forces actual font file download for canvas use
const loadedFonts = new Set<string>();
const loadGoogleFont = (fontName: string): Promise<void> => {
  if (loadedFonts.has(fontName)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    // 1. Add stylesheet link
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // 2. Create a hidden DOM element to force the browser to actually download the font file
    //    (Canvas alone won't trigger CSS font loading)
    const probe = document.createElement('span');
    probe.textContent = 'ABCabc123';
    probe.style.fontFamily = `"${fontName}", sans-serif`;
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    probe.style.top = '-9999px';
    probe.style.fontSize = '48px';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);

    // 3. Use document.fonts.load() to explicitly request the font
    document.fonts.load(`48px "${fontName}"`).then(() => {
      loadedFonts.add(fontName);
      // Clean up probe after a delay
      setTimeout(() => {
        try { document.body.removeChild(probe); } catch {}
      }, 2000);
      resolve();
    }).catch(() => {
      // Fallback: wait for fonts.ready
      document.fonts.ready.then(() => {
        loadedFonts.add(fontName);
        setTimeout(() => {
          try { document.body.removeChild(probe); } catch {}
        }, 2000);
        resolve();
      });
    });
  });
};

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
type PatchSideChoice = 'front' | 'back' | 'both' | null;

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 625;
const ZONE_EDITOR_PREVIEW_WIDTH = 480;
const ZONE_EDITOR_PREVIEW_HEIGHT = 600;

const mapZoneEditorCoordsToImageCoords = (
  coords: { xPercent: number; yPercent: number; widthPercent: number; heightPercent: number; rotation: number; pathData: { x: number; y: number }[] | null },
  imageWidth: number,
  imageHeight: number,
) => {
  const imageRatio = imageWidth / Math.max(imageHeight, 1);
  const boxRatio = ZONE_EDITOR_PREVIEW_WIDTH / ZONE_EDITOR_PREVIEW_HEIGHT;
  const renderedWidth = imageRatio > boxRatio ? ZONE_EDITOR_PREVIEW_WIDTH : ZONE_EDITOR_PREVIEW_HEIGHT * imageRatio;
  const renderedHeight = imageRatio > boxRatio ? ZONE_EDITOR_PREVIEW_WIDTH / imageRatio : ZONE_EDITOR_PREVIEW_HEIGHT;
  const offsetX = (ZONE_EDITOR_PREVIEW_WIDTH - renderedWidth) / 2;
  const offsetY = (ZONE_EDITOR_PREVIEW_HEIGHT - renderedHeight) / 2;
  const xPx = (coords.xPercent / 100) * ZONE_EDITOR_PREVIEW_WIDTH;
  const yPx = (coords.yPercent / 100) * ZONE_EDITOR_PREVIEW_HEIGHT;
  const wPx = (coords.widthPercent / 100) * ZONE_EDITOR_PREVIEW_WIDTH;
  const hPx = (coords.heightPercent / 100) * ZONE_EDITOR_PREVIEW_HEIGHT;
  return {
    ...coords,
    xPercent: ((xPx - offsetX) / Math.max(renderedWidth, 1)) * 100,
    yPercent: ((yPx - offsetY) / Math.max(renderedHeight, 1)) * 100,
    widthPercent: (wPx / Math.max(renderedWidth, 1)) * 100,
    heightPercent: (hPx / Math.max(renderedHeight, 1)) * 100,
  };
};

// Custom rotation icon renderer — draws a circular arrow that's unmistakable
const renderRotateIcon = (ctx: CanvasRenderingContext2D, left: number, top: number, _styleOverride: any, fabricObject: any) => {
  const size = 28;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate((fabricObject.angle * Math.PI) / 180);

  // Background circle
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Circular arrow
  ctx.beginPath();
  ctx.arc(0, 0, size / 4, -Math.PI * 0.8, Math.PI * 0.6);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Arrow head
  const arrowAngle = Math.PI * 0.6;
  const arrowX = (size / 4) * Math.cos(arrowAngle);
  const arrowY = (size / 4) * Math.sin(arrowAngle);
  ctx.beginPath();
  ctx.moveTo(arrowX - 4, arrowY - 5);
  ctx.lineTo(arrowX, arrowY);
  ctx.lineTo(arrowX + 5, arrowY - 3);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.restore();
};

// Configure Fabric.js selection controls globally — large, high-contrast circles for mobile touch
FabricObject.ownDefaults = {
  ...FabricObject.ownDefaults,
  cornerSize: 24,
  touchCornerSize: 48,
  cornerStyle: 'circle' as const,
  cornerColor: '#2563eb',
  cornerStrokeColor: '#ffffff',
  transparentCorners: false,
  borderColor: '#2563eb',
  borderScaleFactor: 2.5,
  padding: 10,
  borderDashArray: [6, 3],
};

// Custom mtr control — applied to each canvas object after creation
const customMtrControl = new Control({
  x: 0,
  y: -0.5,
  offsetY: -40,
  actionHandler: controlsUtils.rotationWithSnapping,
  cursorStyleHandler: controlsUtils.rotationStyleHandler,
  withConnection: true,
  actionName: 'rotate',
  render: renderRotateIcon,
});

const ShirtEditor = ({ useOwnAssets }: ShirtEditorProps) => {
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontFabricRef = useRef<Canvas | null>(null);
  const backFabricRef = useRef<Canvas | null>(null);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState<ToolbarTab>(null);
  const [showUvPanel, setShowUvPanel] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [allStamps, setAllStamps] = useState<Stamp[]>([]);
  const [patches, setPatches] = useState<{ id: string; name: string; imageUrl: string; targetZoneName: string }[]>([]);
  const [allPatches, setAllPatches] = useState<{ id: string; name: string; imageUrl: string; targetZoneName: string }[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [preview3D, setPreview3D] = useState<{ front: string; back: string } | null>(null);
  const [uv3DCanvas, setUv3DCanvas] = useState<HTMLCanvasElement | null>(null);
  const [uvTextureVersion, setUvTextureVersion] = useState(0);
  const [show2DEditor, setShow2DEditor] = useState(false);
  const [editsVersion, setEditsVersion] = useState(0);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([0, 0.1, 5.2]);
  // Debounced bump: re-composite the UV texture at most every ~120ms while the
  // user is typing / dragging. Prevents the editor from re-rendering on every
  // keystroke, which was causing visible lag in the 3D preview.
  const bumpTimerRef = useRef<number | null>(null);
  const bumpEdits = useCallback(() => {
    if (bumpTimerRef.current != null) return;
    bumpTimerRef.current = window.setTimeout(() => {
      bumpTimerRef.current = null;
      setEditsVersion(v => v + 1);
    }, 120);
  }, []);
  useEffect(() => () => {
    if (bumpTimerRef.current != null) {
      clearTimeout(bumpTimerRef.current);
      bumpTimerRef.current = null;
    }
    if (uvTextCommitTimerRef.current != null) {
      clearTimeout(uvTextCommitTimerRef.current);
      uvTextCommitTimerRef.current = null;
    }
  }, []);
  // Universal UV fallback: the GLB is the same for every shirt, so any uv_map
  // registered by the user can be used when a specific template/stamp doesn't
  // have one linked yet. Without this, 3D used to stay blank for most templates.
  const [fallbackUvUrl, setFallbackUvUrl] = useState<string | null>(null);
  const [appliedStamp, setAppliedStamp] = useState<Stamp | null>(null);

  // ===== UV-based personalization (new pipeline) =====
  const [uvMapZones, setUvMapZones] = useState<Record<string, UvZone>>({});
  const [uvMapDims, setUvMapDims] = useState<{ w: number | null; h: number | null }>({ w: null, h: null });
  const [uvLayers, setUvLayers] = useState<UvLayer[]>([]);
  const [uvTextDrafts, setUvTextDrafts] = useState<Record<string, string>>({});
  const uvTextCommitTimerRef = useRef<number | null>(null);
  const uvBaseUrl = appliedStamp?.uvMapUrl ?? selectedTemplate?.uvMapUrl ?? fallbackUvUrl ?? null;
  const uvZonesActive = Object.keys(uvMapZones).length > 0;

  // SVG Color Personalization (Fase 1 & 2)
  const [svgColors, setSvgColors] = useState<Map<string, SvgColorGroup>>(new Map());
  const [svgTexts, setSvgTexts] = useState<any[]>([]);
  const [svgImages, setSvgImages] = useState<any[]>([]);
  const [svgFeatures, setSvgFeatures] = useState<any[]>([]);
  const [analyzingColors, setAnalyzingColors] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const svgAnalyzer = useRef(new SvgAnalyzer());


  // Fetch uv_zones / dims for the selected template's UV map.
  useEffect(() => {
    let cancelled = false;
    const uvMapId = selectedTemplate?.uvMapId;
    if (!uvMapId) { setUvMapZones({}); setUvMapDims({ w: null, h: null }); setUvLayers([]); return; }
    (async () => {
      const { data } = await supabase
        .from('uv_maps' as any)
        .select('uv_zones, uv_width, uv_height')
        .eq('id', uvMapId)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as any;
      setUvMapZones((row.uv_zones && typeof row.uv_zones === 'object') ? row.uv_zones : {});
      setUvMapDims({ w: row.uv_width ?? null, h: row.uv_height ?? null });
      setUvLayers([]);
      setUvTextDrafts({});
    })();
    return () => { cancelled = true; };
  }, [selectedTemplate?.uvMapId]);

  const uvComposite = useUvCompositor({
    baseUrl: uvZonesActive ? uvBaseUrl : null,
    zones: uvMapZones,
    layers: uvLayers,
    uvWidth: uvMapDims.w,
    uvHeight: uvMapDims.h,
    svgOverlay: svgContent,
  });


  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [strokeColor, setStrokeColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');

  const handleSvgAnalysis = async (url: string) => {
    try {
      setAnalyzingColors(true);
      const response = await fetch(toProxyUrl(url));
      const svgText = await response.text();
      setSvgContent(svgText);
      const { colors, texts, images, features } = await svgAnalyzer.current.analyze(svgText);
      setSvgColors(colors);
      setSvgTexts(texts);
      setSvgImages(images);
      setSvgFeatures(features);
      
      // Chamar IA para classificar tudo
      const colorList = Array.from(colors.values()).map(c => ({ hex: c.hex, count: c.usageCount }));
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('analyze-stamp-colors', {
        body: { 
          colors: colorList,
          texts: texts.map(t => ({ id: t.id, text: t.text })),
          images: images.map(img => ({ id: img.id }))
        }
      });
      
      if (!aiError && aiResult) {
        // Atualizar cores
        const colorClassifications = aiResult.colors || [];
        setSvgColors(prev => {
          const next = new Map(prev);
          colorClassifications.forEach((item: any) => {
            if (item.hex && next.has(item.hex.toUpperCase())) {
              const group = next.get(item.hex.toUpperCase())!;
              group.groupName = item.group;
              group.reason = item.reason;
            }
          });
          return next;
        });

        // Atualizar textos com nomes amigáveis
        if (aiResult.texts) {
          setSvgTexts(prev => prev.map(t => {
            const classification = aiResult.texts.find((ai: any) => ai.id === t.id);
            return classification ? { ...t, groupName: classification.group } : t;
          }));
        }

        // Atualizar imagens com nomes amigáveis
        if (aiResult.images) {
          setSvgImages(prev => prev.map(img => {
            const classification = aiResult.images.find((ai: any) => ai.id === img.id);
            return classification ? { ...img, groupName: classification.group } : img;
          }));
        }

        // Auto-detectar e ativar a aba de personalização se houver elementos
        if (colors.size > 0 || (aiResult.texts && aiResult.texts.length > 0) || (aiResult.images && aiResult.images.length > 0)) {
          setActiveTab('stamps'); // Mantém a aba de estampas mas os controles de cor estarão visíveis
        }
      }
    } catch (err) {
      console.error('Erro ao analisar SVG:', err);
      toast.error('Não foi possível analisar os elementos da estampa');
    } finally {
      setAnalyzingColors(false);
    }
  };

  const updateSvgColor = (key: string, newCmyk: any) => {
    if (!svgContent) return;
    const newHex = cmykToHex(newCmyk);
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const updatedSvg = svgAnalyzer.current.updateColor(svgDoc, key, newHex);
    setSvgContent(updatedSvg);
    
    // Atualizar o mapa de cores local para refletir a mudança na UI
    setSvgColors(prev => {
      const next = new Map(prev);
      const group = next.get(key);
      if (group) {
        // We keep the same key (layer ID or old hex) but update the color values
        next.set(key, { ...group, hex: newHex, cmyk: newCmyk });
      }
      return next;
    });
    
    bumpEdits();
  };

  const updateSvgText = (id: string, newText: string) => {
    if (!svgContent) return;
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const updatedSvg = svgAnalyzer.current.updateText(svgDoc, id, newText);
    setSvgContent(updatedSvg);
    setSvgTexts(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t));
    bumpEdits();
  };

  const updateSvgImage = (id: string, newHref: string) => {
    if (!svgContent) return;
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const updatedSvg = svgAnalyzer.current.updateImage(svgDoc, id, newHref);
    setSvgContent(updatedSvg);
    setSvgImages(prev => prev.map(img => img.id === id ? { ...img, href: newHref } : img));
    bumpEdits();
  };

  const toggleSvgElement = (id: string, visible: boolean, type: 'text' | 'image' | 'feature') => {
    if (!svgContent) return;
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const updatedSvg = svgAnalyzer.current.toggleVisibility(svgDoc, id, visible);
    setSvgContent(updatedSvg);
    
    if (type === 'text') setSvgTexts(prev => prev.map(t => t.id === id ? { ...t, visible } : t));
    if (type === 'image') setSvgImages(prev => prev.map(img => img.id === id ? { ...img, visible } : img));
    if (type === 'feature') setSvgFeatures(prev => prev.map(f => f.id === id ? { ...f, visible } : f));
    
    bumpEdits();
  };

  const handleSvgImageUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      updateSvgImage(id, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(4);
  const [textCurvature, setTextCurvature] = useState(0); // -100..100

  const commitUvLayerText = (zoneKey: string, content: string) => {
    setUvLayers(prev => {
      const existing = prev.find(l => l.zoneKey === zoneKey && l.type === 'text');
      if (existing) {
        if (!content) return prev.filter(l => l !== existing);
        return prev.map(l => l === existing ? { ...l, content, color: textColor, strokeColor, strokeWidth, fontFamily, fontSize, fontWeight: 900, curvature: textCurvature } as UvLayer : l);
      }
      if (!content) return prev;
      return [...prev, { id: `${zoneKey}_${Date.now()}`, zoneKey, type: 'text', content, color: textColor, strokeColor, strokeWidth, fontFamily, fontSize, fontWeight: 900, curvature: textCurvature }];
    });
  };

  const setUvLayerText = (zoneKey: string, content: string) => {
    setUvTextDrafts(prev => ({ ...prev, [zoneKey]: content }));
    if (uvTextCommitTimerRef.current != null) window.clearTimeout(uvTextCommitTimerRef.current);
    uvTextCommitTimerRef.current = window.setTimeout(() => {
      uvTextCommitTimerRef.current = null;
      commitUvLayerText(zoneKey, content);
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

  const removeUvLayer = (zoneKey: string, type?: 'text' | 'image') => {
    setUvLayers(prev => prev.filter(l => l.zoneKey !== zoneKey || (type ? l.type !== type : false)));
    if (!type || type === 'text') setUvTextDrafts(prev => ({ ...prev, [zoneKey]: '' }));
  };

  useEffect(() => {
    const imgScale = Math.max(0.2, Math.min(2.5, fontSize / 60));
    setUvLayers(prev => prev.map(l => {
      if (l.type === 'text') {
        return { ...l, color: textColor, strokeColor, strokeWidth, fontFamily, fontSize, fontWeight: 900, curvature: textCurvature } as UvLayer;
      }
      if (l.type === 'image') {
        return { ...l, scale: imgScale } as UvLayer;
      }
      return l;
    }));
  }, [textColor, strokeColor, strokeWidth, fontFamily, fontSize, textCurvature]);

  const handleOpen3D = () => {
    const frontCanvas = frontFabricRef.current;
    const backCanvas = backFabricRef.current;
    if (!frontCanvas || !backCanvas) return;
    try {
      const front = exportCanvas(frontCanvas);
      const back = exportCanvas(backCanvas);
      setPreview3D({ front, back });
      setShow3D(true);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar pré-visualização 3D');
    }
  };
  // Name tab
  const [nameInput, setNameInput] = useState('');
  const [numberInput, setNumberInput] = useState('');
  // Emblems tab
  const [emblems, setEmblems] = useState<{ id: string; name: string; imageUrl: string; nicheId: string | null }[]>([]);
  const [clientEmblems, setClientEmblems] = useState<{ id: string; name: string; imageUrl: string }[]>([]);
  const emblemInputRef = useRef<HTMLInputElement>(null);
  const [textStyles, setTextStyles] = useState<{ id: string; name: string; category: string; imageUrl: string }[]>([]);
  const [selectedTextStyle, setSelectedTextStyle] = useState<{ name: string; imageUrl: string } | null>(null);
  const [stampColors, setStampColors] = useState<StampColor[]>([]);
  const [activeStampColorId, setActiveStampColorId] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [showLogoNotice, setShowLogoNotice] = useState(false);
  const [showTextStylesOverlay, setShowTextStylesOverlay] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const uploadedLogoFileRef = useRef<File | null>(null);
  const [showZonePicker, setShowZonePicker] = useState<'text' | 'logo' | null>(null);
  const [pendingPatch, setPendingPatch] = useState<{ id: string; name: string; imageUrl: string; targetZoneName: string } | null>(null);
  const [patchSideChoice, setPatchSideChoice] = useState<'front' | 'back' | 'both' | null>(null);
  const [frontZoom, setFrontZoom] = useState(1);
  const [backZoom, setBackZoom] = useState(1);
  const [panMode, setPanMode] = useState(false);
  const isPanningRef = useRef(false);
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);
  const frontWrapRef = useRef<HTMLDivElement>(null);
  const backWrapRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileCanvasContainerRef = useRef<HTMLDivElement>(null);
  const [mobileScale, setMobileScale] = useState(1);

  // ─── Interactive Guide State ──────────────────────────────
  const [guideStep, setGuideStep] = useState<GuideStep>('niche');
  const [guideEnabled, setGuideEnabled] = useState(() => {
    try { return sessionStorage.getItem('editor-guide-dismissed') !== 'true'; }
    catch { return true; }
  });

  const advanceGuide = useCallback((from: GuideStep, to: GuideStep) => {
    if (!guideEnabled) return;
    setGuideStep(prev => prev === from ? to : prev);
  }, [guideEnabled]);

  const skipGuideStep = useCallback(() => {
    setGuideStep(prev => {
      const order: GuideStep[] = ['niche', 'template', 'stamps-tab', 'stamp-pick', 'stamp-color', 'patches-tab', 'patch-pick', 'text-tab', 'text-pick', 'logo-tab', 'budget', 'done'];
      const idx = order.indexOf(prev);
      return order[Math.min(idx + 1, order.length - 1)];
    });
  }, []);

  const dismissGuide = useCallback(() => {
    setGuideEnabled(false);
    setGuideStep('done');
    try { sessionStorage.setItem('editor-guide-dismissed', 'true'); } catch {}
  }, []);

  // Prefer UV-based zones; fall back to legacy template zones
  const { zones: uvZones } = useTemplateZones(undefined, selectedTemplate?.uvMapId ?? undefined);
  const { zones: legacyZones } = useTemplateZones(
    selectedTemplate?.uvMapId ? undefined : selectedTemplate?.id
  );
  const templateZones = (selectedTemplate?.uvMapId && uvZones.length > 0) ? uvZones : legacyZones;
  const usingUvZones = Boolean(selectedTemplate?.uvMapId && uvZones.length > 0);
  const zoneMatchesSide = (zone: TemplateZone, side: 'front' | 'back') => usingUvZones || zone.side === side || zone.shared;

  // 3D UV texture:
  // Always bake the front+back canvas user edits (text/logos) onto the UV at the
  // same percent coordinates the zones use, so anything the client edits shows in 3D.
  useEffect(() => {
    const uv = appliedStamp?.uvMapUrl || selectedTemplate?.uvMapUrl || fallbackUvUrl;
    if (!uv) { setUv3DCanvas(null); return; }
    let alive = true;
    (async () => {
      try {
        // Start from UV image. If template (not stamp) UV, optionally overlay stamp.
        const base = appliedStamp?.uvMapUrl
          ? await (async () => {
              const img = await loadUvImage(uv);
              const c = document.createElement('canvas');
              c.width = img.naturalWidth; c.height = img.naturalHeight;
              c.getContext('2d')!.drawImage(img, 0, 0);
              return c;
            })()
          : await composeUvWithStamp(uv, appliedStamp?.imageUrl ?? null);

        const ctx = base.getContext('2d')!;

        const bakeCanvas = (fc: Canvas | null) => {
          if (!fc) return;
          const side: 'front' | 'back' = fc === frontFabricRef.current ? 'front' : 'back';
          const originalVpt = fc.viewportTransform ? ([...fc.viewportTransform] as typeof fc.viewportTransform) : undefined;
          try {
            // Render the whole edit layer instead of each object individually.
            // This keeps absolute zone clips/polygon masks valid, which is what
            // makes text/logos chosen inside marked zones appear on the UV/3D.
            fc.discardActiveObject();
            fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
            fc.setZoom(1);
            fc.requestRenderAll();
            const MULT = 2;
            const layer = fc.toCanvasElement(MULT, {
              left: 0,
              top: 0,
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              filter: (obj: any) => Boolean(obj._userElement && !obj._isBackground),
            });
            // The 2D editor canvas and the UV image are different layouts.
            // For each zone visible on this side, copy that zone's pixel region from
            // the rendered edit layer into the matching zone region on the UV image,
            // so user-added text/logos appear where the user actually placed them.
            const zonesForSide = templateZones.filter((z) => zoneMatchesSide(z, side));
            if (zonesForSide.length === 0) {
              // Fallback: stretch whole layer (legacy behavior)
              ctx.drawImage(layer, 0, 0, base.width, base.height);
            } else {
              for (const z of zonesForSide) {
                const c = getZoneCoordsForSide(z, side);
                // Zones are stored as percentages — use them directly on both
                // the source (edit canvas) and destination (UV image). No
                // letterboxing reprojection: matches the reference system's
                // UV_POSITIONS approach (xPercent * uvWidth, yPercent * uvHeight).
                const sx = (c.xPercent / 100) * CANVAS_WIDTH * MULT;
                const sy = (c.yPercent / 100) * CANVAS_HEIGHT * MULT;
                const sw = (c.widthPercent / 100) * CANVAS_WIDTH * MULT;
                const sh = (c.heightPercent / 100) * CANVAS_HEIGHT * MULT;
                const dx = (c.xPercent / 100) * base.width;
                const dy = (c.yPercent / 100) * base.height;
                const dw = (c.widthPercent / 100) * base.width;
                const dh = (c.heightPercent / 100) * base.height;
                if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;
                try {
                  ctx.drawImage(layer, sx, sy, sw, sh, dx, dy, dw, dh);
                } catch (e) {
                  // ignore out-of-bounds
                }
              }
            }
          } catch (err) {
            console.warn('bake canvas failed', err);
          } finally {
            if (originalVpt) fc.setViewportTransform(originalVpt);
            fc.requestRenderAll();
          }
        };
        bakeCanvas(frontFabricRef.current);
        bakeCanvas(backFabricRef.current);

        if (alive) {
          setUv3DCanvas(base);
          setUvTextureVersion(v => v + 1);
        }
      } catch (e) {
        console.warn('UV compose failed', e);
      }
    })();
    return () => { alive = false; };
  }, [selectedTemplate?.uvMapUrl, appliedStamp?.uvMapUrl, appliedStamp?.imageUrl, fallbackUvUrl, editsVersion, templateZones, usingUvZones]);

  // Effective UV URL passed to <Shirt3DPreview /> — stamp UV wins over template UV.
  // Falls back to any registered UV map so 3D always has a texture to paint.
  const effectiveUvUrl = appliedStamp?.uvMapUrl || selectedTemplate?.uvMapUrl || fallbackUvUrl || null;

  const frontStampRef = useRef<FabricImage | null>(null);
  const backStampRef = useRef<FabricImage | null>(null);
  const frontClipRef = useRef<FabricImage | null>(null);
  const backClipRef = useRef<FabricImage | null>(null);

  const getActiveCanvas = useCallback(() => {
    return activeView === 'front' ? frontFabricRef.current : backFabricRef.current;
  }, [activeView]);

  const getActiveStampRef = useCallback(() => {
    return activeView === 'front' ? frontStampRef : backStampRef;
  }, [activeView]);

  const getActiveClipPath = useCallback(() => {
    return activeView === 'front' ? frontClipRef.current : backClipRef.current;
  }, [activeView]);

  // Anti-copy/download protections for corporate patch images
  useEffect(() => {
    const blockContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Block right-click on the entire editor to prevent "Save Image As"
      if (target.closest('.patch-protected') || target.tagName === 'CANVAS') {
        e.preventDefault();
      }
    };
    const blockKeys = (e: KeyboardEvent) => {
      // Block Ctrl+S, Ctrl+U (view source), Ctrl+Shift+I (dev tools), PrintScreen
      if (
        (e.ctrlKey && (e.key === 's' || e.key === 'u' || e.key === 'S' || e.key === 'U')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
      }
    };
    const blockDrag = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.patch-protected') || target.tagName === 'IMG') {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', blockContext);
    document.addEventListener('keydown', blockKeys);
    document.addEventListener('dragstart', blockDrag);
    return () => {
      document.removeEventListener('contextmenu', blockContext);
      document.removeEventListener('keydown', blockKeys);
      document.removeEventListener('dragstart', blockDrag);
    };
  }, []);

  // Determine which user's assets to load
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);

  useEffect(() => {
    if (urlUserId) {
      setOwnerUserId(urlUserId);
    } else if (useOwnAssets) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setOwnerUserId(session?.user?.id ?? null);
      });
    }
  }, [urlUserId, useOwnAssets]);

  // Fetch templates, stamps, patches, text styles and niches filtered by owner
  useEffect(() => {
    if (!ownerUserId) return;
    const fetchData = async () => {
      const [templatesRes, stampsRes, patchesRes, textStylesRes, nichesRes, uvMapsRes] = await Promise.all([
        supabase.from('shirt_templates').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('stamp_catalog').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('patch_catalog').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('text_styles').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('niches').select('*').eq('user_id', ownerUserId).order('position', { ascending: true }),
        supabase.from('uv_maps' as any).select('id, image_url, code, name').eq('user_id', ownerUserId),
      ]);
      const uvMapById = new Map<string, string>();
      const uvMapByCode = new Map<string, { id: string; url: string }>();
      ((uvMapsRes.data as any[]) ?? []).forEach((u: any) => {
        uvMapById.set(u.id, u.image_url);
        const norm = (s: string) => (s || '').toString().trim().toLowerCase();
        if (u.code) uvMapByCode.set(norm(u.code), { id: u.id, url: u.image_url });
        if (u.name) uvMapByCode.set(norm(u.name), { id: u.id, url: u.image_url });
      });
      // Pick the first available UV map as the universal fallback for 3D.
      const firstUv = ((uvMapsRes.data as any[]) ?? [])[0];
      setFallbackUvUrl(firstUv?.image_url ?? null);
      const matchByName = (name: string | null | undefined) => {
        if (!name) return null;
        return uvMapByCode.get(name.trim().toLowerCase()) ?? null;
      };
      const resolveUv = (uvId: string | null, legacyUrl: string | null, name?: string | null) => {
        if (uvId && uvMapById.get(uvId)) return uvMapById.get(uvId)!;
        if (legacyUrl) return legacyUrl;
        const m = matchByName(name);
        return m?.url ?? null;
      };
      const resolveUvId = (uvId: string | null, name?: string | null) => {
        if (uvId) return uvId;
        const m = matchByName(name);
        return m?.id ?? null;
      };
      const rawTemplates = (templatesRes.data as any[])?.map(t => ({
        id: t.id, name: t.name, frontImageUrl: t.front_image_url, backImageUrl: t.back_image_url,
        uvMapId: resolveUvId(t.uv_map_id ?? null, t.name),
        uvMapUrl: resolveUv(t.uv_map_id ?? null, t.uv_map_url ?? null, t.name),
        userId: t.user_id, nicheId: t.niche_id ?? null,
      })) ?? [];
      const misplacedStampTemplates = rawTemplates.filter(isMisplacedStampTemplate);
      const allT = rawTemplates.filter(t => !isMisplacedStampTemplate(t));
      setAllTemplates(allT);
      setTemplates(allT);
      const catalogStamps = (stampsRes.data as any[])?.map(s => ({
        id: s.id, name: s.name, category: s.category, imageUrl: s.image_url, backImageUrl: s.back_image_url ?? null,
        uvMapId: resolveUvId(s.uv_map_id ?? null, s.name),
        uvMapUrl: resolveUv(s.uv_map_id ?? null, s.uv_map_url ?? null, s.name),
        templateId: s.template_id ?? null,
        nicheId: s.niche_id ?? null,
      })).filter((s: any) => !/\/uv-library\//i.test(s.imageUrl || '')) ?? [];
      const recoveredStamps = misplacedStampTemplates.map(t => ({
        id: `template-${t.id}`, name: t.name, category: 'Geral', imageUrl: t.frontImageUrl, backImageUrl: t.backImageUrl,
        uvMapId: t.uvMapId, uvMapUrl: t.uvMapUrl, nicheId: t.nicheId,
      }));
      const allS = [...recoveredStamps, ...catalogStamps];
      setAllStamps(allS);
      setStamps(allS);
      const allP = (patchesRes.data as any[])?.map(p => ({
        id: p.id, name: p.name, imageUrl: p.image_url, targetZoneName: p.target_zone_name, nicheId: p.niche_id ?? null,
      })) ?? [];
      setAllPatches(allP);
      setPatches(allP);
      setTextStyles((textStylesRes.data as any[])?.map(ts => ({
        id: ts.id, name: ts.name, category: ts.category, imageUrl: ts.image_url,
      })) ?? []);
      // Emblems (admin-curated library, filtered by owner)
      try {
        const { data: emblemsData } = await (supabase as any)
          .from('emblems')
          .select('id, name, image_url, niche_id')
          .eq('user_id', ownerUserId)
          .eq('active', true)
          .order('position', { ascending: true });
        setEmblems(((emblemsData as any[]) ?? []).map(e => ({
          id: e.id, name: e.name, imageUrl: e.image_url, nicheId: e.niche_id ?? null,
        })));
      } catch (e) { console.warn('emblems fetch failed', e); }
      setNiches((nichesRes.data as any[])?.map(n => ({
        id: n.id, name: n.name, icon: n.icon, patchLabel: n.patch_label, coverImageUrl: n.cover_image_url || '', backgroundImageUrl: n.background_image_url || '',
      })) ?? []);
      // Fetch stamp colors
      fetchAllStampColors(ownerUserId).then(setStampColors);
      setLoading(false);
    };
    fetchData();
  }, [ownerUserId]);

  // Load background image onto a canvas
  const loadBackground = useCallback(async (canvas: Canvas, imageUrl: string, side: 'front' | 'back') => {
    try {
      const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
      const scale = Math.min(CANVAS_WIDTH / img.width!, CANVAS_HEIGHT / img.height!);
      const left = (CANVAS_WIDTH - img.width! * scale) / 2;
      const top = (CANVAS_HEIGHT - img.height! * scale) / 2;
      img.set({ scaleX: scale, scaleY: scale, left, top, selectable: false, evented: false });
      (img as any)._isBackground = true;
      canvas.insertAt(0, img);

      const clipImg = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
      clipImg.set({ scaleX: scale, scaleY: scale, left, top, absolutePositioned: true });
      if (side === 'front') frontClipRef.current = clipImg;
      else backClipRef.current = clipImg;
      canvas.renderAll();
    } catch (e) {
      console.error('Failed to load background:', e);
    }
  }, []);

  // Initialize canvases
  useEffect(() => {
    if (!selectedTemplate || !frontCanvasRef.current || !backCanvasRef.current) return;
    if (frontFabricRef.current) return;

    const frontCanvas = new Canvas(frontCanvasRef.current, {
      width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: 'transparent',
      selection: true, enableRetinaScaling: true, imageSmoothingEnabled: true,
    });
    frontFabricRef.current = frontCanvas;

    const backCanvas = new Canvas(backCanvasRef.current, {
      width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: 'transparent',
      selection: true, enableRetinaScaling: true, imageSmoothingEnabled: true,
    });
    backFabricRef.current = backCanvas;

    // Custom controls for all added objects — ensure large handles + rotation icon
    const customizeControls = (canvas: Canvas) => {
      canvas.on('object:added', (e) => {
        const obj = e.target;
        if (!obj || (obj as any)._isBackground) return;

        // Force large, visible corner handles on every user object (mobile touch)
        obj.set({
          cornerSize: 24,
          touchCornerSize: 48,
          cornerStyle: 'circle' as const,
          cornerColor: '#2563eb',
          cornerStrokeColor: '#ffffff',
          transparentCorners: false,
          borderColor: '#2563eb',
          borderScaleFactor: 2.5,
          padding: 10,
          borderDashArray: [6, 3],
        });

        // Replace rotation control with custom prominent one
        obj.controls.mtr = customMtrControl;
      });
      canvas.on('object:added', (e) => { if (!(e.target as any)?._isBackground) bumpEdits(); });
      canvas.on('object:modified', () => bumpEdits());
      canvas.on('object:moving', () => bumpEdits());
      canvas.on('object:scaling', () => bumpEdits());
      canvas.on('object:rotating', () => bumpEdits());
      canvas.on('text:changed', () => bumpEdits());
      canvas.on('object:removed', (e) => { if (!(e.target as any)?._isBackground) bumpEdits(); });
    };

    customizeControls(frontCanvas);
    customizeControls(backCanvas);

    loadBackground(frontCanvas, toProxyUrl(selectedTemplate.frontImageUrl), 'front');
    loadBackground(backCanvas, toProxyUrl(selectedTemplate.backImageUrl), 'back');

    return () => {
      frontCanvas.dispose(); backCanvas.dispose();
      frontFabricRef.current = null; backFabricRef.current = null;
      frontStampRef.current = null; backStampRef.current = null;
      frontClipRef.current = null; backClipRef.current = null;
    };
  }, [selectedTemplate, loadBackground]);

  const activeZoom = activeView === 'front' ? frontZoom : backZoom;
  const setActiveZoom = activeView === 'front' ? setFrontZoom : setBackZoom;

  // Apply zoom — keep canvas at fixed size, use viewport transform to zoom+center
  useEffect(() => {
    const canvas = activeView === 'front' ? frontFabricRef.current : backFabricRef.current;
    if (!canvas) return;
    const zoom = activeView === 'front' ? frontZoom : backZoom;
    const vpt = canvas.viewportTransform!;
    // Center the zoomed content within the fixed canvas
    const offsetX = (CANVAS_WIDTH - CANVAS_WIDTH * zoom) / 2;
    const offsetY = (CANVAS_HEIGHT - CANVAS_HEIGHT * zoom) / 2;
    canvas.setViewportTransform([zoom, 0, 0, zoom, offsetX, offsetY]);
    canvas.requestRenderAll();
    // Enable pan mode automatically when zoomed in on mobile
    if (zoom > 1) {
      setPanMode(true);
    }
  }, [frontZoom, backZoom, activeView]);

  // Pan + wheel zoom + touch pan (mobile)
  useEffect(() => {
    const front = frontFabricRef.current;
    const back = backFabricRef.current;
    if (!front || !back) return;

    const setupPan = (canvas: Canvas, side: 'front' | 'back') => {
      canvas.on('mouse:down', (opt) => {
        const evt = opt.e as any;
        const isTouch = evt.type?.startsWith('touch');
        // Desktop: alt+click or middle click. Mobile: panMode active (always pans)
        if (evt.altKey || evt.button === 1 || (isTouch && panMode)) {
          isPanningRef.current = true;
          const clientX = isTouch ? evt.touches[0].clientX : evt.clientX;
          const clientY = isTouch ? evt.touches[0].clientY : evt.clientY;
          lastPanPoint.current = { x: clientX, y: clientY };
          canvas.selection = false;
          evt.preventDefault(); evt.stopPropagation();
        }
      });
      canvas.on('mouse:move', (opt) => {
        if (!isPanningRef.current || !lastPanPoint.current) return;
        const evt = opt.e as any;
        const isTouch = evt.type?.startsWith('touch');
        const clientX = isTouch ? evt.touches[0].clientX : evt.clientX;
        const clientY = isTouch ? evt.touches[0].clientY : evt.clientY;
        const vpt = canvas.viewportTransform!;
        vpt[4] += clientX - lastPanPoint.current.x;
        vpt[5] += clientY - lastPanPoint.current.y;
        lastPanPoint.current = { x: clientX, y: clientY };
        canvas.requestRenderAll();
      });
      canvas.on('mouse:up', () => {
        if (isPanningRef.current) {
          isPanningRef.current = false; lastPanPoint.current = null;
          if (!panMode) canvas.selection = true;
        }
      });
      canvas.on('mouse:wheel', (opt) => {
        const evt = opt.e as WheelEvent;
        evt.preventDefault(); evt.stopPropagation();
        let newZoom = canvas.getZoom() * (1 - evt.deltaY / 400);
        newZoom = Math.max(0.3, Math.min(2.5, newZoom));
        if (side === 'front') setFrontZoom(newZoom); else setBackZoom(newZoom);
      });
    };
    setupPan(front, 'front');
    setupPan(back, 'back');
    return () => {
      front.off('mouse:down'); front.off('mouse:move'); front.off('mouse:up'); front.off('mouse:wheel');
      back.off('mouse:down'); back.off('mouse:move'); back.off('mouse:up'); back.off('mouse:wheel');
    };
  }, [selectedTemplate, panMode]);

  // Auto-scroll to active canvas
  useEffect(() => {
    const wrapRef = activeView === 'front' ? frontWrapRef : backWrapRef;
    if (wrapRef.current && scrollContainerRef.current) {
      wrapRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeView]);

  // Calculate mobile scale to fit canvas in viewport
  useEffect(() => {
    const container = mobileCanvasContainerRef.current;
    if (!container) return;
    const updateScale = () => {
      // Only scale on mobile (< 1024px)
      if (window.innerWidth >= 1024) { setMobileScale(1); return; }
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const scaleW = containerWidth / CANVAS_WIDTH;
      const scaleH = containerHeight / CANVAS_HEIGHT;
      setMobileScale(Math.min(scaleW, scaleH));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(container);
    window.addEventListener('resize', updateScale);
    return () => { ro.disconnect(); window.removeEventListener('resize', updateScale); };
  }, [selectedTemplate]);

  const handleSelectTemplate = (template: Template) => {
    advanceGuide('template', 'stamps-tab');
    if (frontFabricRef.current) { frontFabricRef.current.dispose(); frontFabricRef.current = null; }
    if (backFabricRef.current) { backFabricRef.current.dispose(); backFabricRef.current = null; }
    frontStampRef.current = null; backStampRef.current = null;
    frontClipRef.current = null; backClipRef.current = null;
    setActiveView('front');
    setSelectedTemplate(template);
  };

  // Helper to add a text object to a specific canvas+side with zone coords
  // Build an arc path for curved text
  const addTextToCanvas = async (canvas: Canvas, side: 'front' | 'back', zone?: TemplateZone) => {
    const clipPath = side === 'front' ? frontClipRef.current : backClipRef.current;
    const fontDef = FONT_OPTIONS.find(f => f.value === fontFamily);
    if (fontDef?.google) await loadGoogleFont(fontFamily);

    const isMultiline = textInput.includes('\n');

    // Use Textbox for multiline, FabricText for single line
    let text: FabricText | Textbox;
    const textShadow = shadowEnabled ? new Shadow({ color: shadowColor, blur: shadowBlur, offsetX: 2, offsetY: 2 }) : undefined;
    if (isMultiline) {
      text = new Textbox(textInput, {
        fontSize, fill: textColor, fontFamily,
        stroke: strokeWidth > 0 ? strokeColor : undefined,
        strokeWidth: strokeWidth > 0 ? strokeWidth : 0,
        width: 300,
        textAlign: 'center',
        shadow: textShadow,
      });
    } else {
      text = new FabricText(textInput, {
        fontSize, fill: textColor, fontFamily,
        stroke: strokeWidth > 0 ? strokeColor : undefined,
        strokeWidth: strokeWidth > 0 ? strokeWidth : 0,
        shadow: textShadow,
      });
    }


    let zoneClipData: any = null;
    if (zone) {
      const coords = getZoneCoordsForSide(zone, side);
      const zoneX = (coords.xPercent / 100) * CANVAS_WIDTH;
      const zoneY = (coords.yPercent / 100) * CANVAS_HEIGHT;
      const zoneW = (coords.widthPercent / 100) * CANVAS_WIDTH;
      const zoneH = (coords.heightPercent / 100) * CANVAS_HEIGHT;
      const tw = text.width || 100;
      const th = text.height || fontSize;
      const fitScale = Math.min(zoneW / tw, zoneH / th);

      let textClip: any = clipPath || undefined;
      if (coords.pathData && coords.pathData.length >= 3) {
        const polyPoints = coords.pathData.map((p: { x: number; y: number }) => ({
          x: (p.x / 100) * CANVAS_WIDTH,
          y: (p.y / 100) * CANVAS_HEIGHT,
        }));
        textClip = new Polygon(polyPoints, { absolutePositioned: true, inverted: false });
        zoneClipData = coords.pathData;
      }

      text.set({
        left: zoneX + zoneW / 2,
        top: zoneY + zoneH / 2,
        scaleX: fitScale, scaleY: fitScale,
        angle: coords.rotation || 0,
        originX: 'center', originY: 'center',
        clipPath: textClip,
      });
    } else {
      text.set({ left: CANVAS_WIDTH / 2 - (text.width || 100) / 2, top: CANVAS_HEIGHT / 2, clipPath: clipPath || undefined });
    }

    (text as any)._userElement = true;
    (text as any)._elementType = 'text';
    (text as any)._fontName = fontFamily;
    (text as any)._textContent = textInput;
    if (zoneClipData) (text as any)._zoneClipData = zoneClipData;
    // Apply arc curvature (single-line only)
    if (textCurvature && !isMultiline) {
      try { applyArcToText(text as FabricText, textCurvature); } catch (e) { console.warn(e); }
    }
    canvas.add(text);
    return text;
  };

  // Add text — if zone is shared, add to both canvases
  const addTextAtZone = async (zone?: TemplateZone) => {
    if (!textInput.trim()) return;
    const activeCanvas = getActiveCanvas();
    if (!activeCanvas) return;

    if (zone && zone.shared) {
      const frontCanvas = frontFabricRef.current;
      const backCanvas = backFabricRef.current;
      if (frontCanvas && backCanvas) {
        const [frontText] = await Promise.all([
          addTextToCanvas(frontCanvas, 'front', zone),
          addTextToCanvas(backCanvas, 'back', zone),
        ]);
        frontCanvas.setActiveObject(frontText);
        frontCanvas.renderAll();
        backCanvas.renderAll();
      }
    } else {
      const text = await addTextToCanvas(activeCanvas, activeView, zone);
      activeCanvas.setActiveObject(text);
      activeCanvas.renderAll();
    }

    setTextInput(''); setShowZonePicker(null);
    advanceGuide('text-pick', 'logo-tab');
  };

  const handleAddTextClick = () => {
    if (!textInput.trim()) return;
    const zonesForSide = templateZones.filter(z => !z.patchOnly && zoneMatchesSide(z, activeView));
    if (zonesForSide.length > 0) setShowZonePicker('text');
    else addTextAtZone();
  };

  // Apply stamp to canvas
  const applyStampToCanvas = async (canvas: Canvas, imageUrl: string, side: 'front' | 'back') => {
    try {
      const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
      const objects = canvas.getObjects();
      const bgObj = objects.find((o: any) => o._isBackground);
      if (bgObj) canvas.remove(bgObj);

      const scale = Math.min(CANVAS_WIDTH / img.width!, CANVAS_HEIGHT / img.height!);
      const left = (CANVAS_WIDTH - img.width! * scale) / 2;
      const top = (CANVAS_HEIGHT - img.height! * scale) / 2;
      img.set({ scaleX: scale, scaleY: scale, left, top, selectable: false, evented: false });
      (img as any)._isBackground = true;
      canvas.insertAt(0, img);

      const clipImg = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });
      clipImg.set({ scaleX: scale, scaleY: scale, left, top, absolutePositioned: true });
      if (side === 'front') frontClipRef.current = clipImg;
      else backClipRef.current = clipImg;

      const newClip = side === 'front' ? frontClipRef.current : backClipRef.current;
      canvas.getObjects().forEach((obj: any) => {
        if (obj._userElement && !obj._isBackground) {
          // If this object had a polygon zone clip, rebuild it instead of using template clip
          if (obj._zoneClipData && obj._zoneClipData.length >= 3) {
            const polyPoints = obj._zoneClipData.map((p: { x: number; y: number }) => ({
              x: (p.x / 100) * CANVAS_WIDTH,
              y: (p.y / 100) * CANVAS_HEIGHT,
            }));
            obj.set({ clipPath: new Polygon(polyPoints, { absolutePositioned: true, inverted: false }) });
          } else {
            obj.set({ clipPath: newClip || undefined });
          }
        }
      });
      canvas.renderAll();
    } catch {
      toast.error('Erro ao carregar estampa');
    }
  };

  const addStamp = async (stamp: Stamp) => {
    const frontCanvas = frontFabricRef.current;
    const backCanvas = backFabricRef.current;
    if (!frontCanvas || !backCanvas) return;
    
    // Analyze SVG if the stamp is a vector
    const isSvg = stamp.imageUrl.toLowerCase().endsWith('.svg') || stamp.uvMapUrl?.toLowerCase().endsWith('.svg');
    if (isSvg) {
      const urlToAnalyze = stamp.imageUrl.toLowerCase().endsWith('.svg') ? stamp.imageUrl : stamp.uvMapUrl!;
      handleSvgAnalysis(urlToAnalyze);
      // Auto-focus the stamp tab where adjustments appear
      setTimeout(() => setActiveTab('stamps'), 100);
    } else {
      setSvgContent(null);
      setSvgColors(new Map());
      setSvgTexts([]);
      setSvgImages([]);
      setSvgFeatures([]);
    }

    // If the stamp is linked to a different template, swap the active template
    // so the 3D preview (UV + zones) reflects the template configured for it.
    if (stamp.templateId && stamp.templateId !== selectedTemplate?.id) {
      const linked = allTemplates.find(t => t.id === stamp.templateId);
      if (linked) setSelectedTemplate(linked);
    }

    const backUrl = stamp.backImageUrl || stamp.imageUrl;
    try {
      await Promise.all([
        applyStampToCanvas(frontCanvas, toProxyUrl(stamp.imageUrl), 'front'),
        applyStampToCanvas(backCanvas, toProxyUrl(backUrl), 'back'),
      ]);
      // stamp applied silently
      // Tag stamp metadata on front canvas objects
      frontCanvas.getObjects().forEach((obj: any) => {
        if (obj._isBackground) { obj._stampName = stamp.name; obj._stampCategory = stamp.category; }
      });
      backCanvas.getObjects().forEach((obj: any) => {
        if (obj._isBackground) { obj._stampName = stamp.name; obj._stampCategory = stamp.category; }
      });
      setAppliedStamp(stamp);
      setActiveStampColorId(null);
      advanceGuide('stamp-pick', 'stamp-color');
      // Auto-advance to text-tab if no colors available
      const hasColors = stampColors.some(c => c.stampId === stamp.id);
      if (!hasColors) advanceGuide('stamp-color', 'patches-tab');
    } catch (err) {
      console.error('Erro ao aplicar estampa:', err);
      toast.error('Erro ao aplicar estampa');
    }
  };

  // Switch stamp to a color variant
  const switchStampColor = async (color: StampColor) => {
    const frontCanvas = frontFabricRef.current;
    const backCanvas = backFabricRef.current;
    if (!frontCanvas || !backCanvas) return;
    const backUrl = color.backImageUrl ? toProxyUrl(color.backImageUrl) : toProxyUrl(color.imageUrl);
    try {
      await Promise.all([
        applyStampToCanvas(frontCanvas, toProxyUrl(color.imageUrl), 'front'),
        applyStampToCanvas(backCanvas, backUrl, 'back'),
      ]);
      setActiveStampColorId(color.id);
      advanceGuide('stamp-color', 'patches-tab');
    } catch {
      toast.error('Erro ao trocar cor');
    }
  };

  // Switch back to original stamp images
  const switchToOriginalStamp = async () => {
    if (!appliedStamp) return;
    const frontCanvas = frontFabricRef.current;
    const backCanvas = backFabricRef.current;
    if (!frontCanvas || !backCanvas) return;
    const backUrl = appliedStamp.backImageUrl || appliedStamp.imageUrl;
    try {
      await Promise.all([
        applyStampToCanvas(frontCanvas, appliedStamp.imageUrl, 'front'),
        applyStampToCanvas(backCanvas, backUrl, 'back'),
      ]);
      setActiveStampColorId(null);
    } catch {
      toast.error('Erro ao restaurar estampa');
    }
  };

  // Get colors for the currently applied stamp
  const appliedStampColors = appliedStamp ? stampColors.filter(c => c.stampId === appliedStamp.id) : [];




  // Helper to get zone coords for a specific side
  const getZoneCoordsForSide = (zone: TemplateZone, side: 'front' | 'back') => {
    const useBack = !usingUvZones && zone.shared && zone.side !== side;
    return {
      xPercent: useBack ? zone.backXPercent : zone.xPercent,
      yPercent: useBack ? zone.backYPercent : zone.yPercent,
      widthPercent: useBack ? zone.backWidthPercent : zone.widthPercent,
      heightPercent: useBack ? zone.backHeightPercent : zone.heightPercent,
      rotation: useBack ? zone.backRotation : zone.rotation,
      pathData: useBack ? zone.backPathData : zone.pathData,
    };
  };

  // Add patch (peixe) to a specific zone on chosen side(s)
  const addPatchToZone = async (patch: { id: string; name: string; imageUrl: string }, zone: TemplateZone) => {
    const sides: ('front' | 'back')[] = zone.shared ? ['front', 'back'] : [zone.side === 'front' ? 'front' : 'back'];

    for (const side of sides) {
      const canvas = side === 'front' ? frontFabricRef.current : backFabricRef.current;
      const templateClip = side === 'front' ? frontClipRef.current : backClipRef.current;
      if (!canvas) continue;

      const coords = getZoneCoordsForSide(zone, side);

      try {
        const img = await FabricImage.fromURL(patch.imageUrl, { crossOrigin: 'anonymous' });
        const zoneX = (coords.xPercent / 100) * CANVAS_WIDTH;
        const zoneY = (coords.yPercent / 100) * CANVAS_HEIGHT;
        const zoneW = (coords.widthPercent / 100) * CANVAS_WIDTH;
        const zoneH = (coords.heightPercent / 100) * CANVAS_HEIGHT;
        const scale = Math.min(zoneW / img.width!, zoneH / img.height!);
        const left = zoneX + (zoneW - img.width! * scale) / 2;
        const top = zoneY + (zoneH - img.height! * scale) / 2;

        // Build clipPath: use polygon contour if available, otherwise template silhouette
        let clipPath: any = templateClip || undefined;
        if (coords.pathData && coords.pathData.length >= 3) {
          const polyPoints = coords.pathData.map(p => ({
            x: (p.x / 100) * CANVAS_WIDTH,
            y: (p.y / 100) * CANVAS_HEIGHT,
          }));
          clipPath = new Polygon(polyPoints, {
            absolutePositioned: true,
            inverted: false,
          });
        }

        img.set({ left, top, scaleX: scale, scaleY: scale, clipPath, angle: coords.rotation || 0 });
        (img as any)._userElement = true;
        (img as any)._elementType = 'patch';
        (img as any)._patchName = patch.name;
        (img as any)._zoneClipData = coords.pathData; // store for reference
        canvas.add(img);
        canvas.renderAll();
      } catch {
        toast.error('Erro ao carregar imagem do peixe');
      }
    }
    // patch applied silently
    setPendingPatch(null);
    setPatchSideChoice(null);
  };

  const handlePatchClick = (patch: { id: string; name: string; imageUrl: string; targetZoneName: string }) => {
    advanceGuide('patch-pick', 'text-tab');
    setPendingPatch(patch);
    setPatchSideChoice(null);
  };

  const handlePatchSideSelect = async (side: 'front' | 'back' | 'both') => {
    if (!pendingPatch) return;

    // Try to auto-apply using targetZoneName or find matching zones for the chosen side(s)
    const targetName = pendingPatch.targetZoneName?.trim().toLowerCase();

    if (side === 'both') {
      // Find zones for front and back
      // Priority: 1) patchOnly zone matching name, 2) any patchOnly zone, 3) exact name match, 4) shared zone
      const findZoneForSide = (s: 'front' | 'back') =>
        templateZones.find(z => z.patchOnly && targetName && z.name.toLowerCase() === targetName && zoneMatchesSide(z, s)) ||
        templateZones.find(z => z.patchOnly && zoneMatchesSide(z, s)) ||
        templateZones.find(z => targetName && z.name.toLowerCase() === targetName && zoneMatchesSide(z, s)) ||
        templateZones.find(z => z.shared);

      const frontZone = findZoneForSide('front');
      const backZone = findZoneForSide('back');

      if (frontZone || backZone) {
        const applied: string[] = [];
        if (frontZone) {
          await addPatchToSide(pendingPatch, frontZone, 'front');
          applied.push('frente');
        }
        if (backZone) {
          await addPatchToSide(pendingPatch, backZone, 'back');
          applied.push('costas');
        }
        // patches applied silently
        setPendingPatch(null);
        setPatchSideChoice(null);
        return;
      }
    } else {
      // Single side - find matching zone (prefer patchOnly, then name match, then shared)
      const zone = templateZones.find(z => z.patchOnly && targetName && z.name.toLowerCase() === targetName && zoneMatchesSide(z, side))
        || templateZones.find(z => z.patchOnly && zoneMatchesSide(z, side))
        || templateZones.find(z => targetName && z.name.toLowerCase() === targetName && zoneMatchesSide(z, side))
        || templateZones.find(z => z.shared);

      if (zone) {
        await addPatchToSide(pendingPatch, zone, side);
        // patch applied silently
        setPendingPatch(null);
        setPatchSideChoice(null);
        return;
      }
    }

    // Fallback: no zones found, show zone picker
    setPatchSideChoice(side);
  };

  // Add patch to a specific side of a zone (without the shared duplication logic)
  const addPatchToSide = async (patch: { id: string; name: string; imageUrl: string }, zone: TemplateZone, side: 'front' | 'back') => {
    const canvas = side === 'front' ? frontFabricRef.current : backFabricRef.current;
    const templateClip = side === 'front' ? frontClipRef.current : backClipRef.current;
    if (!canvas) return;

    const coords = getZoneCoordsForSide(zone, side);
    try {
      const img = await FabricImage.fromURL(toProxyUrl(patch.imageUrl), { crossOrigin: 'anonymous' });
      const zoneX = (coords.xPercent / 100) * CANVAS_WIDTH;
      const zoneY = (coords.yPercent / 100) * CANVAS_HEIGHT;
      const zoneW = (coords.widthPercent / 100) * CANVAS_WIDTH;
      const zoneH = (coords.heightPercent / 100) * CANVAS_HEIGHT;
      const scale = Math.min(zoneW / img.width!, zoneH / img.height!);
      const left = zoneX + (zoneW - img.width! * scale) / 2;
      const top = zoneY + (zoneH - img.height! * scale) / 2;

      let clipPath: any = templateClip || undefined;
      if (coords.pathData && coords.pathData.length >= 3) {
        const polyPoints = coords.pathData.map(p => ({
          x: (p.x / 100) * CANVAS_WIDTH,
          y: (p.y / 100) * CANVAS_HEIGHT,
        }));
        clipPath = new Polygon(polyPoints, { absolutePositioned: true, inverted: false });
      }

      img.set({ left, top, scaleX: scale, scaleY: scale, clipPath, angle: coords.rotation || 0 });
      (img as any)._userElement = true;
      (img as any)._elementType = 'patch';
      (img as any)._patchName = patch.name;
      (img as any)._zoneClipData = coords.pathData;
      canvas.add(img);
      canvas.renderAll();
    } catch {
      toast.error('Erro ao carregar imagem do peixe');
    }
  };

  // Get zones available for the chosen side
  const patchAvailableZones = patchSideChoice
    ? templateZones.filter(z => {
        if (patchSideChoice === 'both') return true;
        return zoneMatchesSide(z, patchSideChoice);
      })
    : [];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const zonesForSide = templateZones.filter(z => !z.patchOnly && zoneMatchesSide(z, activeView));
    if (zonesForSide.length > 0) { setPendingLogoFile(file); setShowZonePicker('logo'); }
    else placeLogoFile(file);
  };

  // Helper to place a logo on a specific canvas+side
  const placeLogoOnCanvas = async (dataUrl: string, canvas: Canvas, side: 'front' | 'back', zone?: TemplateZone) => {
    const clipPath = side === 'front' ? frontClipRef.current : backClipRef.current;
    const img = await FabricImage.fromURL(dataUrl);
    let left: number, top: number, scale: number;
    let logoClip: any = clipPath || undefined;
    let zoneClipData: any = null;

    if (zone) {
      const coords = getZoneCoordsForSide(zone, side);
      const zoneX = (coords.xPercent / 100) * CANVAS_WIDTH;
      const zoneY = (coords.yPercent / 100) * CANVAS_HEIGHT;
      const zoneW = (coords.widthPercent / 100) * CANVAS_WIDTH;
      const zoneH = (coords.heightPercent / 100) * CANVAS_HEIGHT;
      scale = Math.min(zoneW / img.width!, zoneH / img.height!);
      left = zoneX + (zoneW - img.width! * scale) / 2;
      top = zoneY + (zoneH - img.height! * scale) / 2;

      if (coords.pathData && coords.pathData.length >= 3) {
        const polyPoints = coords.pathData.map((p: { x: number; y: number }) => ({
          x: (p.x / 100) * CANVAS_WIDTH,
          y: (p.y / 100) * CANVAS_HEIGHT,
        }));
        logoClip = new Polygon(polyPoints, { absolutePositioned: true, inverted: false });
        zoneClipData = coords.pathData;
      }

      img.set({ angle: coords.rotation || 0 });
    } else {
      const maxSize = 150;
      scale = Math.min(maxSize / img.width!, maxSize / img.height!);
      left = CANVAS_WIDTH / 2 - (img.width! * scale) / 2;
      top = CANVAS_HEIGHT / 3;
    }

    img.set({ left, top, scaleX: scale, scaleY: scale, clipPath: logoClip });
    (img as any)._userElement = true;
    (img as any)._elementType = 'logo';
    if (zoneClipData) (img as any)._zoneClipData = zoneClipData;
    canvas.add(img);
    return img;
  };

  const placeLogoFile = (file: File, zone?: TemplateZone) => {
    uploadedLogoFileRef.current = file;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target!.result as string;

        if (zone && zone.shared) {
          const frontCanvas = frontFabricRef.current;
          const backCanvas = backFabricRef.current;
          if (frontCanvas && backCanvas) {
            const [frontImg] = await Promise.all([
              placeLogoOnCanvas(dataUrl, frontCanvas, 'front', zone),
              placeLogoOnCanvas(dataUrl, backCanvas, 'back', zone),
            ]);
            frontCanvas.setActiveObject(frontImg);
            frontCanvas.renderAll();
            backCanvas.renderAll();
          }
        } else {
          const canvas = getActiveCanvas();
          if (!canvas) return;
          const img = await placeLogoOnCanvas(dataUrl, canvas, activeView, zone);
          canvas.setActiveObject(img);
          canvas.renderAll();
        }
      } catch { toast.error('Erro ao carregar imagem'); }
    };
    reader.readAsDataURL(file);
    setShowZonePicker(null); setPendingLogoFile(null);
  };

  // ─── Emblems ────────────────────────────────────────────────
  const placeEmblemFromUrl = async (imageUrl: string) => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    try {
      // Use proxy to bypass CORS for catalog images, raw url for blob/data
      const src = imageUrl.startsWith('blob:') || imageUrl.startsWith('data:') ? imageUrl : toProxyUrl(imageUrl);
      const img = await FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
      const maxSize = 180;
      const scale = Math.min(maxSize / img.width!, maxSize / img.height!);
      img.set({
        left: CANVAS_WIDTH / 2 - (img.width! * scale) / 2,
        top: CANVAS_HEIGHT / 3,
        scaleX: scale, scaleY: scale,
        clipPath: (activeView === 'front' ? frontClipRef.current : backClipRef.current) || undefined,
      });
      (img as any)._userElement = true;
      (img as any)._elementType = 'emblem';
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      bumpEdits();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao adicionar emblema');
    }
  };

  const handleEmblemUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      // Upload to public bucket so 3D bake/quote can re-fetch it without CORS issues
      const path = `emblems-uploads/${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await supabase.storage.from('shirt-designs').upload(path, file, { contentType: file.type });
      let url: string;
      if (error) {
        // Fallback: use blob url (won't survive page reload)
        url = URL.createObjectURL(file);
      } else {
        const { data: u } = supabase.storage.from('shirt-designs').getPublicUrl(path);
        url = u.publicUrl;
      }
      const item = { id: `local_${Date.now()}`, name: file.name, imageUrl: url };
      setClientEmblems(prev => [item, ...prev]);
      placeEmblemFromUrl(url);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar emblema');
    }
  };

  // ─── Name preset ───────────────────────────────────────────
  const addNamePreset = async (style: 'arc' | 'straight') => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const nameTxt = nameInput.trim();
    const numTxt = numberInput.trim();
    if (!nameTxt && !numTxt) { toast.error('Digite o nome ou número'); return; }
    const fontDef = FONT_OPTIONS.find(f => f.value === fontFamily);
    if (fontDef?.google) await loadGoogleFont(fontFamily);

    const textShadow = shadowEnabled ? new Shadow({ color: shadowColor, blur: shadowBlur, offsetX: 2, offsetY: 2 }) : undefined;
    const clipPath = (activeView === 'front' ? frontClipRef.current : backClipRef.current) || undefined;

    if (nameTxt) {
      const nameObj = new FabricText(nameTxt, {
        fontSize: Math.max(28, fontSize), fill: textColor, fontFamily,
        stroke: strokeWidth > 0 ? strokeColor : undefined,
        strokeWidth: strokeWidth > 0 ? strokeWidth : 0,
        shadow: textShadow, originX: 'center', originY: 'center',
        left: CANVAS_WIDTH / 2, top: CANVAS_HEIGHT * 0.32,
        clipPath,
      });
      (nameObj as any)._userElement = true;
      (nameObj as any)._elementType = 'name';
      if (style === 'arc') applyArcToText(nameObj, 35);
      canvas.add(nameObj);
    }
    if (numTxt) {
      const numObj = new FabricText(numTxt, {
        fontSize: Math.max(120, fontSize * 4), fill: textColor, fontFamily,
        stroke: strokeWidth > 0 ? strokeColor : undefined,
        strokeWidth: strokeWidth > 0 ? strokeWidth + 1 : 0,
        shadow: textShadow, originX: 'center', originY: 'center',
        left: CANVAS_WIDTH / 2, top: CANVAS_HEIGHT * 0.55,
        clipPath,
      });
      (numObj as any)._userElement = true;
      (numObj as any)._elementType = 'name';
      canvas.add(numObj);
    }
    canvas.requestRenderAll();
    bumpEdits();
    setNameInput(''); setNumberInput('');
  };

  // Live-update text style on active text object
  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && (active instanceof FabricText || active instanceof Textbox) && (active as any)._userElement) {
      const fontDef = FONT_OPTIONS.find(f => f.value === fontFamily);
      const applyFont = async () => {
        if (fontDef?.google) await loadGoogleFont(fontFamily);
        active.set({
          fill: textColor, stroke: strokeWidth > 0 ? strokeColor : undefined,
          strokeWidth: strokeWidth > 0 ? strokeWidth : 0, fontSize, fontFamily,
          shadow: shadowEnabled ? new Shadow({ color: shadowColor, blur: shadowBlur, offsetX: 2, offsetY: 2 }) : undefined,
        });
        (active as any)._fontName = fontFamily;
        // Force Fabric to recalculate text dimensions with new font
        if ('initDimensions' in active && typeof (active as any).initDimensions === 'function') {
          (active as any).initDimensions();
        }
        try { applyArcToText(active as FabricText, textCurvature); } catch (e) { console.warn(e); }
        active.dirty = true;
        active.setCoords();
        canvas.requestRenderAll();
        bumpEdits();
      };
      applyFont();
    }
  }, [textColor, strokeColor, strokeWidth, fontSize, fontFamily, shadowEnabled, shadowColor, shadowBlur, textCurvature, activeView]);

  // Auto-select last text object when text tab is opened (mobile)
  useEffect(() => {
    if (activeTab !== 'text') return;
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && (active instanceof FabricText || active instanceof Textbox) && (active as any)._userElement) return; // already selected
    // Find last text object on canvas
    const objects = canvas.getObjects();
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i] as any;
      if (obj._userElement && obj._elementType === 'text') {
        canvas.setActiveObject(obj);
        canvas.renderAll();
        // Sync UI
        setTextColor((obj.fill as string) || '#000000');
        setFontSize(obj.fontSize || 24);
        setFontFamily(obj.fontFamily || 'Arial');
        setStrokeWidth(obj.strokeWidth || 0);
        setStrokeColor((obj.stroke as string) || '#FFFFFF');
        break;
      }
    }
  }, [activeTab, activeView]);

  // Sync UI controls when a text object is selected
  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const onSelect = () => {
      const active = canvas.getActiveObject();
      if (active && (active instanceof FabricText || active instanceof Textbox) && (active as any)._userElement) {
        setTextColor((active.fill as string) || '#000000');
        setFontSize(active.fontSize || 24);
        setFontFamily(active.fontFamily || 'Arial');
        setStrokeWidth(active.strokeWidth || 0);
        setStrokeColor((active.stroke as string) || '#FFFFFF');
        setTextCurvature((active as any)._curvature || 0);
      }
    };
    canvas.on('selection:created', onSelect);
    canvas.on('selection:updated', onSelect);
    return () => {
      canvas.off('selection:created', onSelect);
      canvas.off('selection:updated', onSelect);
    };
  }, [activeView, selectedTemplate]);

  const deleteSelected = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active && (active as any)._userElement) {
      if ((active as any)._isStamp) getActiveStampRef().current = null;
      canvas.remove(active); canvas.discardActiveObject(); canvas.renderAll();
    }
  };

  // Export
  const exportCanvas = (canvas: Canvas): string => {
    const origBg = canvas.backgroundColor;
    const origZoom = canvas.getZoom();
    const origVpt = [...canvas.viewportTransform!] as typeof canvas.viewportTransform;
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    canvas.setZoom(1);
    canvas.setDimensions({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
    canvas.backgroundColor = 'transparent';
    canvas.discardActiveObject(); canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 4 });
    canvas.backgroundColor = origBg as string;
    canvas.viewportTransform = origVpt;
    canvas.setZoom(origZoom);
    canvas.setDimensions({ width: CANVAS_WIDTH * origZoom, height: CANVAS_HEIGHT * origZoom });
    canvas.renderAll();
    return dataUrl;
  };

  const handleDownload = async () => {
    const frontCanvas = frontFabricRef.current;
    const backCanvas = backFabricRef.current;
    if (!frontCanvas || !backCanvas) return;
    setDownloading(true);
    try {
      const frontDataUrl = exportCanvas(frontCanvas);
      const backDataUrl = exportCanvas(backCanvas);
      const linkFront = document.createElement('a');
      linkFront.download = `${selectedTemplate?.name || 'camisa'}_frente.png`;
      linkFront.href = frontDataUrl; linkFront.click();
      await new Promise(r => setTimeout(r, 500));
      const linkBack = document.createElement('a');
      linkBack.download = `${selectedTemplate?.name || 'camisa'}_costas.png`;
      linkBack.href = backDataUrl; linkBack.click();
      toast.success('Downloads iniciados!');
    } catch (err) {
      console.error(err); toast.error('Erro ao gerar download');
    }
    setDownloading(false);
  };

  // WhatsApp quote - upload previews + logo, send direct wa.me link with all URLs
  const handleWhatsAppQuote = async () => {
    const ownerUserId = selectedTemplate?.userId;
    if (!ownerUserId) { toast.error('Template sem dono identificado'); return; }

    const { data } = await supabase.rpc('get_owner_whatsapp', { _owner: ownerUserId });
    const whatsappNumber = (data as string | null)?.replace(/\D/g, '') || '';

    if (!whatsappNumber) {
      toast.error('Configure o número do WhatsApp em Configurações → WhatsApp');
      return;
    }

    toast.info('Preparando orçamento...');

    const templateName = selectedTemplate?.name || 'Camisa personalizada';
    const frontCanvas = frontFabricRef.current;
    const backCanvas = backFabricRef.current;
    const timestamp = Date.now();
    const imageLinks: string[] = [];

    // Upload canvas previews to storage
    try {
      if (frontCanvas) {
        const frontDataUrl = exportCanvas(frontCanvas);
        const frontBlob = await (await fetch(frontDataUrl)).blob();
        const path = `quotes/${timestamp}_frente.png`;
        const { error } = await supabase.storage.from('shirt-designs').upload(path, frontBlob, { contentType: 'image/png' });
        if (!error) {
          const { data: u } = supabase.storage.from('shirt-designs').getPublicUrl(path);
          imageLinks.push(`📸 Frente: ${u.publicUrl}`);
        }
      }
      if (backCanvas) {
        const backDataUrl = exportCanvas(backCanvas);
        const backBlob = await (await fetch(backDataUrl)).blob();
        const path = `quotes/${timestamp}_costas.png`;
        const { error } = await supabase.storage.from('shirt-designs').upload(path, backBlob, { contentType: 'image/png' });
        if (!error) {
          const { data: u } = supabase.storage.from('shirt-designs').getPublicUrl(path);
          imageLinks.push(`📸 Costas: ${u.publicUrl}`);
        }
      }
    } catch (err) {
      console.error('Error uploading canvas previews:', err);
    }

    // Upload imported logo file if available
    if (uploadedLogoFileRef.current) {
      try {
        const logoFile = uploadedLogoFileRef.current;
        const ext = logoFile.name.split('.').pop() || 'png';
        const path = `quotes/${timestamp}_logo.${ext}`;
        const { error } = await supabase.storage.from('shirt-designs').upload(path, logoFile, { contentType: logoFile.type });
        if (!error) {
          const { data: u } = supabase.storage.from('shirt-designs').getPublicUrl(path);
          imageLinks.push(`📁 Arquivo do cliente: ${u.publicUrl}`);
        }
      } catch (err) {
        console.error('Error uploading logo file:', err);
      }
    }

    // Collect design details from both canvases
    const designDetails: string[] = [];
    const stampNames = new Set<string>();
    const patchNames = new Set<string>();
    const textElements: { text: string; font: string }[] = [];
    let hasLogo = false;

    [frontCanvas, backCanvas].forEach(canvas => {
      if (!canvas) return;
      canvas.getObjects().forEach((obj: any) => {
        if (obj._isBackground && obj._stampName) {
          stampNames.add(`${obj._stampName}${obj._stampCategory ? ` (${obj._stampCategory})` : ''}`);
        }
        if (obj._userElement) {
          if (obj._elementType === 'text' && obj._textContent) {
            textElements.push({ text: obj._textContent, font: obj._fontName || 'Arial' });
          }
          if (obj._elementType === 'patch' && obj._patchName) {
            patchNames.add(obj._patchName);
          }
          if (obj._elementType === 'logo') hasLogo = true;
        }
      });
    });

    if (stampNames.size > 0) designDetails.push(`🎨 Estampa: ${[...stampNames].join(', ')}`);
    if (patchNames.size > 0) designDetails.push(`🐟 Peixes: ${[...patchNames].join(', ')}`);
    textElements.forEach(t => designDetails.push(`✏️ Texto: "${t.text}" — Fonte: ${t.font}`));
    if (selectedTextStyle) designDetails.push(`🎨 Estilo de texto: ${selectedTextStyle.name}\n📎 Referência: ${selectedTextStyle.imageUrl}`);
    if (hasLogo) designDetails.push(`📎 Logo personalizado incluso`);

    const message =
      `Olá! Gostaria de fazer um orçamento para:\n\n` +
      `🎽 Modelo: ${templateName}\n` +
      (designDetails.length > 0 ? `\n${designDetails.join('\n')}\n\n` : `\n`) +
      (imageLinks.length > 0 ? `📎 *Arquivos:*\n${imageLinks.join('\n')}\n\n` : '') +
      `Poderia me enviar mais informações sobre valores e prazos?`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
  };

  // Handle niche selection — filter templates/stamps/patches by niche
  const handleSelectNiche = (niche: Niche) => {
    setSelectedNiche(niche);
    setTemplates(allTemplates.filter(t => t.nicheId === niche.id || !t.nicheId));
    setStamps(allStamps.filter((s: any) => s.nicheId === niche.id || !s.nicheId));
    setPatches(allPatches.filter((p: any) => p.nicheId === niche.id || !p.nicheId));
    advanceGuide('niche', 'template');
  };

  const handleBackToNiches = () => {
    setSelectedNiche(null);
    setTemplates(allTemplates);
    setStamps(allStamps);
    setPatches(allPatches);
  };

  // Get current niche's patch label
  const currentPatchLabel = selectedNiche?.patchLabel || 'Emblemas';

  // Auto-adjust guide if no niches exist
  useEffect(() => {
    if (!loading && niches.length === 0 && guideStep === 'niche') {
      setGuideStep('template');
    }
  }, [loading, niches.length, guideStep]);

  // ─── Niche selection screen ────────────────────────────────
  if (!selectedTemplate && !selectedNiche && niches.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <img src={logo} alt="Logo" className="h-10 w-auto mx-auto mb-3" />
            <h1 className="text-2xl font-bold font-display">Editor de Camisas</h1>
            <p className="text-muted-foreground mt-1">Escolha o segmento para começar</p>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {niches.map(n => {
                const nicheTemplates = allTemplates.filter(t => t.nicheId === n.id);
                const coverImage = n.coverImageUrl || nicheTemplates[0]?.frontImageUrl;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleSelectNiche(n)}
                    data-guide="niche"
                    className="group rounded-2xl border-2 border-border/50 bg-card overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all flex flex-col items-center"
                  >
                    {coverImage ? (
                      <div className="w-full aspect-[3/4] bg-muted/30 overflow-hidden">
                        <img src={coverImage} alt={n.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform protected-img" />
                      </div>
                    ) : (
                      <div className="w-full aspect-[3/4] bg-muted/30 flex items-center justify-center">
                        <span className="text-5xl opacity-40">{n.icon}</span>
                      </div>
                    )}
                    <div className="text-center py-3 px-2">
                      <p className="text-base font-bold group-hover:text-primary transition-colors">{n.name}</p>
                      <p className="text-xs text-muted-foreground">{nicheTemplates.length} modelo{nicheTemplates.length !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {guideEnabled && <EditorGuide step={guideStep} onSkip={skipGuideStep} onDismissAll={dismissGuide} />}
      </div>
    );
  }

  // ─── Template selection screen ────────────────────────────────
  if (!selectedTemplate) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <img src={logo} alt="Logo" className="h-10 w-auto mx-auto mb-3" />
            {selectedNiche && (
              <button onClick={handleBackToNiches} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
                <ChevronLeft className="h-4 w-4" /> Voltar aos segmentos
              </button>
            )}
            <h1 className="text-2xl font-bold font-display">
              {selectedNiche ? `${selectedNiche.icon} ${selectedNiche.name}` : 'Editor de Camisas'}
            </h1>
            <p className="text-muted-foreground mt-1">Escolha um modelo para personalizar</p>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground">Carregando templates...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum template disponível</p>
              {selectedNiche && (
                <Button variant="outline" className="mt-4" onClick={handleBackToNiches}>Voltar aos segmentos</Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  data-guide="template"
                  className="group rounded-xl border border-border/50 bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="grid grid-cols-2 gap-1 p-2">
                    <img src={t.frontImageUrl} alt="Frente" loading="lazy" decoding="async" className="w-full aspect-[3/4] object-contain rounded bg-muted/30 protected-img" />
                    <img src={t.backImageUrl} alt="Costas" loading="lazy" decoding="async" className="w-full aspect-[3/4] object-contain rounded bg-muted/30 protected-img" />
                  </div>
                  <div className="px-3 py-2.5 border-t border-border/30">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">{t.name}</p>
                    <p className="text-xs text-muted-foreground">Clique para personalizar</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {guideEnabled && <EditorGuide step={guideStep} onSkip={skipGuideStep} onDismissAll={dismissGuide} />}
      </div>
    );
  }

  // Select a text style as reference (not applied to canvas)
  const selectTextStyle = (style: { imageUrl: string; name: string }) => {
    setSelectedTextStyle(style);
    // style selected silently
  };

  // ─── Editor screen ────────────────────────────────────────────
  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      {/* Top header — dark, vibrant */}
      <header className="bg-sidebar px-3 py-2.5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)} className="h-8 px-2 text-sidebar-foreground hover:bg-sidebar-accent">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Voltar</span>
          </Button>
          <span className="text-sm font-semibold text-sidebar-foreground truncate max-w-[140px] sm:max-w-none">{selectedTemplate.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { advanceGuide('budget', 'done'); handleWhatsAppQuote(); }} data-guide="budget" className="gap-1.5 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-white h-9 px-3 rounded-full shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span className="hidden sm:inline">Orçamento</span>
          </Button>
          <Button onClick={handleDownload} disabled={downloading} size="sm" className="gap-1 h-9 px-3 bg-accent text-accent-foreground hover:bg-accent/90 rounded-full shadow-sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{downloading ? 'Baixando...' : 'Baixar'}</span>
          </Button>
          <Button onClick={handleOpen3D} size="sm" variant="secondary" className="gap-1 h-9 px-3 rounded-full shadow-sm">
            <Box className="h-4 w-4" />
            <span className="hidden sm:inline">Ver 3D</span>
          </Button>
        </div>
      </header>

      {/* Unified responsive layout */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Top icon toolbar — visible on mobile & desktop, sits ABOVE the 3D so it never covers the shirt */}
        <div className="shrink-0 bg-card/80 backdrop-blur border-b border-border/60 px-2 py-2 overflow-x-auto">
          <div className="flex items-center justify-start lg:justify-center gap-2 lg:gap-3 min-w-max mx-auto">
            {([
              { id: 'stamps',   label: 'Estampas',    icon: Shirt },
            ] as { id: ToolbarTab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(active ? null : id)}
                  className={`flex flex-col items-center justify-center gap-1 px-1 py-1 rounded-xl transition-all active:scale-95 ${active ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <span className={`h-12 w-12 lg:h-14 lg:w-14 rounded-2xl border-2 flex items-center justify-center shadow-sm transition-all ${active ? 'bg-accent text-accent-foreground border-accent shadow-md' : 'bg-background border-accent/60 text-accent'}`}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className={`text-[10px] lg:text-[11px] font-semibold leading-none px-1.5 py-0.5 rounded-full ${active ? 'bg-accent/15 text-accent' : 'text-foreground/80'}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Desktop sidebar panel */}
          {activeTab && (
            <aside className="hidden lg:block lg:w-64 lg:border-r border-border bg-card p-3 overflow-y-auto">
              {activeTab === 'stamps' && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Escolha uma estampa</p>
                  {stamps.length === 0 ? (<p className="text-xs text-muted-foreground py-4 text-center">Nenhuma estampa disponível</p>) : (
                    <div className="grid grid-cols-3 gap-2" data-guide-desktop="stamp-pick">
                      {stamps.map(s => (
                        <button key={s.id} onClick={() => addStamp(s)} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all bg-background" title={s.name}>
                          <StampThumb stampUrl={s.imageUrl} name={s.name} />
                          <p className="text-[9px] text-center text-muted-foreground pb-0.5 truncate px-0.5 group-hover:text-primary transition-colors">{s.name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Color variants for applied stamp - Desktop */}
                  {appliedStampColors.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/30" data-guide-desktop="stamp-color">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Cores - {appliedStamp?.name}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={switchToOriginalStamp}
                          className={`h-8 w-8 rounded-full border-2 transition-all overflow-hidden ${!activeStampColorId ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-border hover:border-primary/50'}`}
                          title="Original"
                        >
                          <img src={appliedStamp?.imageUrl} alt="Original" className="h-full w-full object-cover" />
                        </button>
                        {appliedStampColors.map(c => (
                          <button
                            key={c.id}
                            onClick={() => switchStampColor(c)}
                            className={`h-8 w-8 rounded-full border-2 transition-all ${activeStampColorId === c.id ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-border hover:border-primary/50'}`}
                            style={{ backgroundColor: c.colorHex }}
                            title={c.colorName}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Vectorize Call to Action for non-SVG stamps */}
                  {appliedStamp && (
                    <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase">Personalização Avançada</span>
                      </div>
                      
                      {appliedStamp.imageUrl.toLowerCase().endsWith('.svg') ? (
                        <>
                          <p className="text-[9px] text-muted-foreground leading-snug">
                            Vetor detectado! Você pode alterar as cores CMYK, trocar logos e editar textos diretamente na arte.
                          </p>
                          <div className="flex flex-col gap-2 pt-1">
                            {/* Color controls */}
                            {Array.from(svgColors.entries()).length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Cores da Estampa</p>
                                <div className="grid grid-cols-5 gap-1.5">
                                  {Array.from(svgColors.entries()).map(([key, group]) => (
                                    <div key={key} className="group/color relative">
                                      <button
                                        onClick={() => {
                                          const input = document.createElement('input');
                                          input.type = 'color';
                                          input.value = group.hex;
                                          input.onchange = (e) => {
                                            const newHex = (e.target as HTMLInputElement).value;
                                            updateSvgColor(key, hexToCmyk(newHex));
                                          };
                                          input.click();
                                        }}
                                        className="h-7 w-full rounded-md border border-border/50 shadow-sm transition-transform active:scale-95"
                                        style={{ backgroundColor: group.hex }}
                                        title={`${group.groupName || 'Cor'}: ${group.hex}`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Text controls */}
                            {svgTexts.length > 0 && (
                              <div className="space-y-1.5 pt-1 border-t border-border/10">
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Textos da Arte</p>
                                <div className="space-y-1">
                                  {svgTexts.map(txt => (
                                    <div key={txt.id} className="flex gap-1.5 items-center">
                                      <Input 
                                        value={txt.text}
                                        onChange={(e) => updateSvgText(txt.id, e.target.value)}
                                        className="h-6 text-[9px] bg-background/50"
                                        placeholder={txt.groupName || 'Texto'}
                                      />
                                      <button 
                                        onClick={() => toggleSvgElement(txt.id, !txt.visible, 'text')}
                                        className={`p-1 rounded ${txt.visible !== false ? 'text-primary' : 'text-muted-foreground'}`}
                                      >
                                        <Box className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Image/Logo controls */}
                            {svgImages.length > 0 && (
                              <div className="space-y-1.5 pt-1 border-t border-border/10">
                                <p className="text-[8px] font-bold text-muted-foreground uppercase">Logos e Imagens</p>
                                <div className="grid grid-cols-1 gap-1">
                                  {svgImages.map(img => (
                                    <div key={img.id} className={`flex gap-1.5 items-center p-1 rounded ${img.isFixed ? 'bg-muted/30 border border-dashed border-border/50' : 'bg-background/30'}`}>
                                      <span className={`text-[8px] flex-1 truncate ${img.isFixed ? 'text-muted-foreground font-medium' : 'opacity-70'}`}>
                                        {img.isFixed ? 'Imagem Fixa (Não Editável)' : (img.groupName || 'Logo')}
                                      </span>
                                      <div className="flex gap-1">
                                        {img.isFixed ? (
                                          <Lock className="h-3 w-3 text-muted-foreground opacity-50" />
                                        ) : (
                                          <>
                                            <button 
                                              onClick={() => toggleSvgElement(img.id, !img.visible, 'image')}
                                              className={`p-1 rounded ${img.visible !== false ? 'text-primary' : 'text-muted-foreground'}`}
                                            >
                                              <Box className="h-3 w-3" />
                                            </button>
                                            <button 
                                              onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.onchange = (e) => handleSvgImageUpload(img.id, e as any);
                                                input.click();
                                              }}
                                              className="p-1 rounded hover:bg-primary/10 text-primary"
                                            >
                                              <Upload className="h-3 w-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <p className="text-[9px] text-amber-700 leading-snug font-medium">
                            Esta estampa não é um vetor nativo. Clique abaixo para vetorizar e habilitar a troca de cores CMYK profissional.
                          </p>
                          <Button 
                            size="sm" 
                            variant="default" 
                            className="w-full h-8 text-[10px] gap-1.5 bg-amber-500 hover:bg-amber-600 border-none shadow-sm"
                            onClick={() => toast.info('Vetorização Inteligente (Fase 2) iniciando...')}
                          >
                            <Sparkles className="h-3 w-3" />
                            Vetorizar com IA
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
              {activeTab === 'patches' && (
                <div className="patch-protected">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{currentPatchLabel}</p>
                  {patches.length === 0 ? (<p className="text-xs text-muted-foreground py-4 text-center">Nenhum {currentPatchLabel.toLowerCase()} disponível</p>) : (
                    <div className="grid grid-cols-3 gap-2">
                      {patches.map(p => (
                        <button key={p.id} onClick={() => handlePatchClick(p)} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all bg-background relative" title={p.name} onContextMenu={e => e.preventDefault()}>
                          <div className="w-full aspect-square p-1 bg-center bg-contain bg-no-repeat select-none" style={{ backgroundImage: `url(${p.imageUrl})` }} draggable={false} aria-hidden="true" />
                          <div className="absolute inset-0" onDragStart={e => e.preventDefault()} />
                          <div className="pb-0.5 px-0.5 relative z-10"><p className="text-[9px] text-center text-muted-foreground truncate group-hover:text-primary transition-colors select-none">{p.name}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'text' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Adicionar texto</p>
                  <Textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Digite o texto... (Enter para quebrar linha)" className="min-h-[60px] text-sm resize-none" rows={2} />
                  <div className="flex gap-2">
                    <Select value={fontFamily} onValueChange={setFontFamily}><SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Fonte" /></SelectTrigger><SelectContent className="max-h-60">{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} className="text-xs" style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent></Select>
                    <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="h-8 w-16 text-xs" min={10} max={72} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground whitespace-nowrap">Cor</label><input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                    <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground whitespace-nowrap">Contorno</label><input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                    <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground whitespace-nowrap">Esp.</label><Input type="number" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="h-7 w-16 text-xs" min={0} max={10} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={shadowEnabled} onChange={e => setShadowEnabled(e.target.checked)} className="rounded" />
                      <span className="text-[10px] text-muted-foreground">Sombra</span>
                    </label>
                    {shadowEnabled && (
                      <>
                        <input type="color" value={shadowColor} onChange={e => setShadowColor(e.target.value)} className="h-6 w-6 rounded border border-border cursor-pointer" />
                        <Input type="number" value={shadowBlur} onChange={e => setShadowBlur(Number(e.target.value))} className="h-7 w-12 text-xs" min={1} max={20} />
                      </>
                    )}
                  </div>
                  {selectedTextStyle && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/30">
                      <img src={selectedTextStyle.imageUrl} alt={selectedTextStyle.name} className="h-8 w-12 object-contain rounded protected-img" />
                      <span className="text-[10px] text-foreground font-medium flex-1 truncate">{selectedTextStyle.name}</span>
                      <button onClick={() => setSelectedTextStyle(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  {textStyles.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setShowTextStylesOverlay(true)} className="w-full gap-1.5 h-8 mb-1"><Sparkles className="h-3.5 w-3.5" /> {selectedTextStyle ? 'Trocar Estilo' : 'Estilos de Texto'}</Button>
                  )}
                  <Button size="sm" onClick={handleAddTextClick} disabled={!textInput.trim()} className="w-full gap-1.5 h-8"><Type className="h-3.5 w-3.5" /> Adicionar</Button>
                </div>
              )}
              {activeTab === 'text' && (
                <div className="px-0 pt-2 -mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-muted-foreground uppercase font-semibold">Curvatura (arco)</label>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{textCurvature}</span>
                  </div>
                  <Slider value={[textCurvature]} onValueChange={([v]) => setTextCurvature(v)} min={-100} max={100} step={1} />
                  <p className="text-[9px] text-muted-foreground/70 mt-1">-100 = arco para baixo · 0 = reto · 100 = arco para cima</p>
                </div>
              )}
              
              {/* Personalização de Cores SVG */}
              {svgContent && svgColors.size > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50 animate-fade-in">
                  <p className="text-xs font-bold text-foreground uppercase mb-3 flex items-center gap-2">
                    <Palette className="h-3.5 w-3.5 text-primary" /> 
                    Cores da Estampa (CMYK)
                  </p>
                  {analyzingColors && (
                    <div className="flex items-center gap-2 mb-4 p-2 bg-primary/5 rounded-lg border border-primary/10 animate-pulse">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-medium text-primary uppercase">IA analisando cores e elementos...</span>
                    </div>
                  )}
                  <div className="space-y-4">
                    {Array.from(svgColors.entries()).map(([key, group]) => (
                      <div key={key} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <div className="flex flex-col mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-foreground">
                                {group.groupName || 'Cor Detectada'}
                              </span>
                              <span className="text-[9px] font-mono text-muted-foreground">{group.hex}</span>
                            </div>
                            <input 
                              type="color" 
                              value={group.hex} 
                              onChange={(e) => updateSvgColor(key, hexToCmyk(e.target.value))}
                              className="h-8 w-8 rounded-lg border border-border cursor-pointer transition-transform hover:scale-110"
                            />
                          </div>
                          {group.reason && (
                            <p className="text-[9px] text-muted-foreground leading-tight italic">
                              {group.reason}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                          <div 
                            className="h-2 w-full rounded-full bg-border/30 overflow-hidden"
                          >
                            <div className="h-full bg-primary/20" style={{ width: `${group.percentage || 100}%` }} />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[9px] font-bold text-cyan-600">C: {group.cmyk.c}%</span>
                            </div>
                            <Slider 
                              value={[group.cmyk.c]} 
                              max={100} 
                              onValueChange={([v]) => updateSvgColor(key, { ...group.cmyk, c: v })}
                              className="h-2"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[9px] font-bold text-magenta-600">M: {group.cmyk.m}%</span>
                            </div>
                            <Slider 
                              value={[group.cmyk.m]} 
                              max={100} 
                              onValueChange={([v]) => updateSvgColor(key, { ...group.cmyk, m: v })}
                              className="h-2"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[9px] font-bold text-yellow-600">Y: {group.cmyk.y}%</span>
                            </div>
                            <Slider 
                              value={[group.cmyk.y]} 
                              max={100} 
                              onValueChange={([v]) => updateSvgColor(key, { ...group.cmyk, y: v })}
                              className="h-2"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[9px] font-bold text-slate-900">K: {group.cmyk.k}%</span>
                            </div>
                            <Slider 
                              value={[group.cmyk.k]} 
                              max={100} 
                              onValueChange={([v]) => updateSvgColor(key, { ...group.cmyk, k: v })}
                              className="h-2"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Textos Editáveis do SVG */}
                  {svgTexts.length > 0 && (
                    <div className="mt-6 space-y-4">
                      <p className="text-xs font-bold text-foreground uppercase flex items-center gap-2">
                        <Type className="h-3.5 w-3.5 text-primary" /> 
                        Textos da Estampa
                      </p>
                      {svgTexts.map((txt) => (
                        <div key={txt.id} className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-foreground">{txt.groupName || 'Texto'}</label>
                            <button 
                              onClick={() => toggleSvgElement(txt.id, !txt.visible, 'text')}
                              className={`p-1 rounded hover:bg-muted transition-colors ${txt.visible === false ? 'text-muted-foreground' : 'text-primary'}`}
                            >
                              {txt.visible === false ? <X className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                            </button>
                          </div>
                          <Input 
                            value={txt.text} 
                            onChange={(e) => updateSvgText(txt.id, e.target.value)}
                            disabled={txt.visible === false}
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Logos/Imagens Editáveis do SVG */}
                  {svgImages.length > 0 && (
                    <div className="mt-6 space-y-4">
                      <p className="text-xs font-bold text-foreground uppercase flex items-center gap-2">
                        <ImageIcon className="h-3.5 w-3.5 text-primary" /> 
                        Imagens / Logos
                      </p>
                      {svgImages.map((img) => (
                        <div key={img.id} className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-foreground">{img.groupName || 'Imagem'}</label>
                            <button 
                              onClick={() => toggleSvgElement(img.id, !img.visible, 'image')}
                              className={`p-1 rounded hover:bg-muted transition-colors ${img.visible === false ? 'text-muted-foreground' : 'text-primary'}`}
                            >
                              {img.visible === false ? <X className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                            </button>
                          </div>
                          <div className={`h-24 w-full bg-background rounded border border-border overflow-hidden flex items-center justify-center p-2 relative group ${img.visible === false ? 'opacity-30' : ''}`}>
                            <img src={img.href} alt="Logo" className="max-h-full max-w-full object-contain" />
                            {img.visible !== false && (
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  className="h-7 text-[10px]"
                                  onClick={() => document.getElementById(`svg-img-up-${img.id}`)?.click()}
                                >
                                  Trocar
                                </Button>
                              </div>
                            )}
                          </div>
                          <input 
                            id={`svg-img-up-${img.id}`}
                            type="file" 
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleSvgImageUpload(img.id, e)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Outros Elementos Toggling */}
                  {svgFeatures.length > 0 && (
                    <div className="mt-6 space-y-4">
                      <p className="text-xs font-bold text-foreground uppercase flex items-center gap-2">
                        <Box className="h-3.5 w-3.5 text-primary" /> 
                        Elementos Opcionais
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {svgFeatures.map((feat) => (
                          <div 
                            key={feat.id} 
                            onClick={() => toggleSvgElement(feat.id, !feat.visible, 'feature')}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${feat.visible === false ? 'bg-muted/20 border-border/50 text-muted-foreground' : 'bg-primary/5 border-primary/20 text-foreground shadow-sm'}`}
                          >
                            <div className={`h-2 w-2 rounded-full ${feat.visible === false ? 'bg-muted-foreground' : 'bg-primary animate-pulse'}`} />
                            <span className="text-[9px] font-bold truncate uppercase">{feat.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'name' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Nome e número</p>
                  <Input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Nome (ex: SILVA)" className="h-9 text-sm uppercase" maxLength={20} />
                  <Input value={numberInput} onChange={e => setNumberInput(e.target.value)} placeholder="Número (opcional)" className="h-9 text-sm" maxLength={3} />
                  <div className="flex gap-2">
                    <Select value={fontFamily} onValueChange={setFontFamily}><SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Fonte" /></SelectTrigger><SelectContent className="max-h-60">{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} className="text-xs" style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent></Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground">Cor</label><input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                    <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground">Contorno</label><input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                    <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground">Esp.</label><Input type="number" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="h-7 w-16 text-xs" min={0} max={10} /></div>
                    <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground">Tam.</label><Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="h-7 w-16 text-xs" min={10} max={120} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => addNamePreset('arc')} className="h-8 text-xs">Esportivo (arco)</Button>
                    <Button size="sm" variant="outline" onClick={() => addNamePreset('straight')} className="h-8 text-xs">Reto</Button>
                  </div>
                </div>
              )}
              {activeTab === 'emblems' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Emblemas</p>
                  {emblems.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum emblema disponível</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {emblems.filter(e => !selectedNiche || !e.nicheId || e.nicheId === selectedNiche.id).map(em => (
                        <button key={em.id} onClick={() => placeEmblemFromUrl(em.imageUrl)} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all bg-background" title={em.name}>
                          <img src={em.imageUrl} loading="lazy" className="w-full aspect-square object-contain p-1 protected-img bg-muted/10" />
                          <p className="text-[9px] text-center text-muted-foreground pb-0.5 truncate px-0.5">{em.name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {clientEmblems.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Meus emblemas</p>
                      <div className="grid grid-cols-3 gap-2">
                        {clientEmblems.map(em => (
                          <button key={em.id} onClick={() => placeEmblemFromUrl(em.imageUrl)} className="group rounded-lg border border-primary/40 overflow-hidden bg-background">
                            <img src={em.imageUrl} className="w-full aspect-square object-contain p-1 bg-muted/10" />
                            <p className="text-[9px] text-center text-muted-foreground pb-0.5 truncate px-0.5">{em.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div onClick={() => emblemInputRef.current?.click()} className="flex items-center gap-2 px-3 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <div><span className="text-xs text-muted-foreground">Enviar meu emblema</span><span className="text-[9px] text-muted-foreground/60 block">PNG, JPG, SVG</span></div>
                  </div>
                  <input ref={emblemInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleEmblemUpload} className="hidden" />
                </div>
              )}
              {activeTab === 'logo' && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Enviar logo ou imagem</p>
                  <div
                    onClick={() => setShowLogoNotice(true)}
                    className="flex flex-col gap-2 items-center py-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div className="text-center"><span className="text-sm text-muted-foreground">Enviar logo ou imagem</span><span className="text-[10px] text-muted-foreground/60 block">PNG, JPG, SVG ou WebP</span></div>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                  <p className="text-[10px] text-muted-foreground text-center">A imagem será aplicada no lado <strong>{activeView === 'front' ? 'Frente' : 'Costas'}</strong></p>
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-border/30">
                <Button variant="outline" size="sm" onClick={deleteSelected} className="w-full gap-1.5 text-destructive h-8 text-xs"><Trash2 className="h-3.5 w-3.5" /> Remover selecionado</Button>
              </div>
              
              {/* Fase 2: Painel de Personalização Avançada Mobile (Auto-expandido) */}
              {svgContent && svgColors.size > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50 animate-fade-in lg:hidden px-1">
                  <p className="text-[10px] font-bold text-foreground uppercase mb-3 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-accent" /> 
                    Ajustes de IA (Fase 2)
                  </p>
                  
                  {/* Cores CMYK */}
                  <div className="space-y-3">
                    {Array.from(svgColors.entries()).slice(0, 3).map(([key, group]) => (
                      <div key={key} className="p-2 rounded-lg bg-muted/30 border border-border/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold truncate flex-1">{group.groupName || 'Cor'}</span>
                          <input 
                            type="color" 
                            value={group.hex} 
                            onChange={(e) => updateSvgColor(key, hexToCmyk(e.target.value))}
                            className="h-6 w-6 rounded border border-border cursor-pointer"
                          />
                        </div>
                      </div>
                    ))}
                    {svgColors.size > 3 && <p className="text-[8px] text-center text-muted-foreground italic">+ {svgColors.size - 3} cores detectadas</p>}
                  </div>

                  {/* Textos da Estampa */}
                  {svgTexts.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {svgTexts.slice(0, 2).map((txt) => (
                        <div key={txt.id} className="space-y-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase">{txt.groupName || 'Texto'}</label>
                          <Input 
                            value={txt.text} 
                            onChange={(e) => updateSvgText(txt.id, e.target.value)}
                            className="h-7 text-xs bg-background"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-7 text-[9px] mt-2 text-primary"
                    onClick={() => setActiveTab('stamps')}
                  >
                    Ver todos os ajustes →
                  </Button>
                </div>
              )}
            </aside>
          )}

          {/* Mobile overlay panel — opens on top of canvas */}
          {activeTab && (
            <div className="lg:hidden absolute inset-x-0 bottom-0 z-30 bg-card border-t-2 border-accent rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.2)] max-h-[45vh] flex flex-col animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <p className="text-sm font-bold text-foreground">
                  {activeTab === 'stamps' ? '🎨 Estampas' : activeTab === 'patches' ? `🏷️ ${currentPatchLabel}` : activeTab === 'text' ? '✏️ Texto' : activeTab === 'name' ? '👕 Nome' : activeTab === 'emblems' ? '🏅 Emblemas' : activeTab === 'logo' ? '📤 Logo / Imagem' : ''}
                </p>
                <button onClick={() => setActiveTab(null)} className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {activeTab === 'stamps' && (
                  <div className="space-y-4">
                    {stamps.length === 0 ? (<p className="text-xs text-muted-foreground py-4 text-center">Nenhuma estampa disponível</p>) : (
                      <div className="grid grid-cols-4 gap-2" data-guide-mobile="stamp-pick">
                        {stamps.map(s => (
                          <button key={s.id} onClick={() => { addStamp(s); }} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all bg-background" title={s.name}>
                            <StampThumb stampUrl={s.imageUrl} name={s.name} />
                            <p className="text-[8px] text-center text-muted-foreground pb-0.5 truncate px-0.5">{s.name}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Personalização Avançada Mobile (Fase 2) */}
                    {appliedStamp && (
                      <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-3 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-[10px] font-bold text-primary uppercase">Ajustes da Arte</span>
                          </div>
                          {appliedStamp.imageUrl.toLowerCase().endsWith('.svg') && (
                            <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">VETOR</span>
                          )}
                        </div>
                        
                        {appliedStamp.imageUrl.toLowerCase().endsWith('.svg') ? (
                          <div className="space-y-4">
                            {/* Color controls */}
                            {Array.from(svgColors.entries()).length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                  <Palette className="h-3 w-3" /> Cores da Estampa (Camadas)
                                </p>
                                <div className="grid grid-cols-4 gap-2">
                                  {Array.from(svgColors.entries()).map(([key, group]) => (
                                    <div key={key} className="flex flex-col items-center gap-1">
                                      <button
                                        onClick={() => {
                                          const input = document.createElement('input');
                                          input.type = 'color';
                                          input.value = group.hex;
                                          input.onchange = (e) => {
                                            const newHex = (e.target as HTMLInputElement).value;
                                            updateSvgColor(key, hexToCmyk(newHex));
                                          };
                                          input.click();
                                        }}
                                        className="h-10 w-full rounded-lg border-2 border-white shadow-md transition-transform active:scale-90"
                                        style={{ backgroundColor: group.hex }}
                                      />
                                      <span className="text-[7px] font-mono truncate w-full text-center opacity-70">
                                        {group.groupName || group.hex}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Text controls */}
                            {svgTexts.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-border/10">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                  <Type className="h-3 w-3" /> Textos
                                </p>
                                <div className="space-y-2">
                                  {svgTexts.map(txt => (
                                    <div key={txt.id} className="flex gap-2 items-center bg-background/50 p-1.5 rounded-lg border border-border/30">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[8px] font-bold text-muted-foreground truncate mb-0.5">{txt.groupName || 'Texto'}</p>
                                        <Input 
                                          value={txt.text} 
                                          onChange={(e) => updateSvgText(txt.id, e.target.value)}
                                          className="h-7 text-[10px] bg-background border-none focus-visible:ring-1"
                                        />
                                      </div>
                                      <button 
                                        onClick={() => toggleSvgElement(txt.id, !txt.visible, 'text')}
                                        className={`p-1.5 rounded-md ${txt.visible !== false ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                                      >
                                        <Box className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Logo controls */}
                            {svgImages.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-border/10">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                  <ImageIcon className="h-3 w-3" /> Logos e Elementos
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {svgImages.map(img => (
                                    <div key={img.id} className={`p-2 rounded-lg border border-border/30 flex flex-col gap-2 ${img.isFixed ? 'bg-muted/10' : 'bg-background/50'}`}>
                                      <div className="flex items-center justify-between">
                                        <span className={`text-[8px] font-bold truncate ${img.isFixed ? 'text-muted-foreground italic' : 'text-muted-foreground'}`}>
                                          {img.isFixed ? 'Imagem Fixa' : (img.groupName || 'Logo')}
                                        </span>
                                        {img.isFixed ? (
                                          <Lock className="h-3 w-3 text-muted-foreground opacity-50" />
                                        ) : (
                                          <button 
                                            onClick={() => toggleSvgElement(img.id, !img.visible, 'image')}
                                            className={`p-1 rounded ${img.visible !== false ? 'text-primary' : 'text-muted-foreground'}`}
                                          >
                                            <Box className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </div>
                                      <div className="aspect-video bg-muted/20 rounded flex items-center justify-center p-1 relative group overflow-hidden">
                                        <img src={img.href} className="max-h-full max-w-full object-contain" />
                                        {!img.isFixed && (
                                          <button 
                                            onClick={() => {
                                              const input = document.createElement('input');
                                              input.type = 'file';
                                              input.accept = 'image/*';
                                              input.onchange = (e) => handleSvgImageUpload(img.id, e as any);
                                              input.click();
                                            }}
                                            className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity"
                                          >
                                            <Upload className="h-4 w-4 text-white" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[9px] text-amber-600 leading-snug font-medium">
                              Habilite a troca de cores CMYK e edição de logos para esta estampa.
                            </p>
                            <Button 
                              size="sm" 
                              className="w-full h-8 text-[10px] gap-1.5 bg-amber-500 hover:bg-amber-600"
                              onClick={() => toast.info('Vetorização Inteligente (Fase 2) iniciando...')}
                            >
                              <Sparkles className="h-3 w-3" />
                              Vetorizar Arte com IA
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Color variants for applied stamp - Mobile */}
                    {appliedStampColors.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border/30" data-guide-mobile="stamp-color">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Cores - {appliedStamp?.name}</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => { switchToOriginalStamp(); }}
                            className={`h-9 w-9 rounded-full border-2 transition-all overflow-hidden ${!activeStampColorId ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-border hover:border-primary/50'}`}
                            title="Original"
                          >
                            <img src={appliedStamp?.imageUrl} alt="Original" className="h-full w-full object-cover" />
                          </button>
                          {appliedStampColors.map(c => (
                            <button
                              key={c.id}
                              onClick={() => { switchStampColor(c); }}
                              className={`h-9 w-9 rounded-full border-2 transition-all ${activeStampColorId === c.id ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-border hover:border-primary/50'}`}
                              style={{ backgroundColor: c.colorHex }}
                              title={c.colorName}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'patches' && (
                  <div className="patch-protected">
                    {patches.length === 0 ? (<p className="text-xs text-muted-foreground py-4 text-center">Nenhum {currentPatchLabel.toLowerCase()} disponível</p>) : (
                      <div className="grid grid-cols-4 gap-2">
                        {patches.map(p => (
                          <button key={p.id} onClick={() => { handlePatchClick(p); setActiveTab(null); }} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all bg-background relative" title={p.name} onContextMenu={e => e.preventDefault()}>
                            <div className="w-full aspect-square p-0.5 bg-center bg-contain bg-no-repeat select-none" style={{ backgroundImage: `url(${p.imageUrl})` }} draggable={false} aria-hidden="true" />
                            <div className="absolute inset-0" onDragStart={e => e.preventDefault()} />
                            <div className="pb-0.5 px-0.5 relative z-10"><p className="text-[8px] text-center text-muted-foreground truncate select-none">{p.name}</p></div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'text' && (
                  <div className="space-y-2">
                    <Textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Digite o texto... (Enter para quebrar linha)" className="min-h-[60px] text-sm resize-none" rows={2} />
                    <div className="flex gap-2">
                      <Select value={fontFamily} onValueChange={setFontFamily}><SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Fonte" /></SelectTrigger><SelectContent className="max-h-60">{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} className="text-xs" style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent></Select>
                      <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="h-8 w-14 text-xs" min={10} max={72} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1"><label className="text-[10px] text-muted-foreground">Cor</label><input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                      <div className="flex items-center gap-1"><label className="text-[10px] text-muted-foreground">Contorno</label><input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                      <div className="flex items-center gap-1"><label className="text-[10px] text-muted-foreground">Esp.</label><Input type="number" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="h-7 w-12 text-xs" min={0} max={10} /></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={shadowEnabled} onChange={e => setShadowEnabled(e.target.checked)} className="rounded" />
                        <span className="text-[10px] text-muted-foreground">Sombra</span>
                      </label>
                      {shadowEnabled && (
                        <>
                          <input type="color" value={shadowColor} onChange={e => setShadowColor(e.target.value)} className="h-6 w-6 rounded border border-border cursor-pointer" />
                          <Input type="number" value={shadowBlur} onChange={e => setShadowBlur(Number(e.target.value))} className="h-7 w-12 text-xs" min={1} max={20} />
                        </>
                      )}
                    </div>
                    {selectedTextStyle && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/30">
                        <img src={selectedTextStyle.imageUrl} alt={selectedTextStyle.name} className="h-8 w-12 object-contain rounded protected-img" />
                        <span className="text-[10px] text-foreground font-medium flex-1 truncate">{selectedTextStyle.name}</span>
                        <button onClick={() => setSelectedTextStyle(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                    {textStyles.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setShowTextStylesOverlay(true)} className="w-full gap-1.5 h-8 mb-1"><Sparkles className="h-3.5 w-3.5" /> {selectedTextStyle ? 'Trocar Estilo' : 'Estilos de Texto'}</Button>
                    )}
                    <Button size="sm" onClick={() => { handleAddTextClick(); }} disabled={!textInput.trim()} className="w-full gap-1.5 h-8"><Type className="h-3.5 w-3.5" /> Adicionar</Button>
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">Curvatura (arco)</label>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{textCurvature}</span>
                      </div>
                      <Slider value={[textCurvature]} onValueChange={([v]) => setTextCurvature(v)} min={-100} max={100} step={1} />
                    </div>
                  </div>
                )}
                {activeTab === 'name' && (
                  <div className="space-y-2">
                    <Input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Nome (ex: SILVA)" className="h-9 text-sm uppercase" maxLength={20} />
                    <Input value={numberInput} onChange={e => setNumberInput(e.target.value)} placeholder="Número (opcional)" className="h-9 text-sm" maxLength={3} />
                    <div className="flex gap-2">
                      <Select value={fontFamily} onValueChange={setFontFamily}><SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Fonte" /></SelectTrigger><SelectContent className="max-h-60">{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} className="text-xs" style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent></Select>
                      <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="h-8 w-14 text-xs" min={10} max={120} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1"><label className="text-[10px] text-muted-foreground">Cor</label><input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                      <div className="flex items-center gap-1"><label className="text-[10px] text-muted-foreground">Contorno</label><input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                      <div className="flex items-center gap-1"><label className="text-[10px] text-muted-foreground">Esp.</label><Input type="number" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="h-7 w-12 text-xs" min={0} max={10} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => addNamePreset('arc')} className="h-8 text-xs">Esportivo (arco)</Button>
                      <Button size="sm" variant="outline" onClick={() => addNamePreset('straight')} className="h-8 text-xs">Reto</Button>
                    </div>
                  </div>
                )}
                {activeTab === 'emblems' && (
                  <div className="space-y-3">
                    {emblems.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum emblema disponível</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {emblems.filter(e => !selectedNiche || !e.nicheId || e.nicheId === selectedNiche.id).map(em => (
                          <button key={em.id} onClick={() => { placeEmblemFromUrl(em.imageUrl); setActiveTab(null); }} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 bg-background" title={em.name}>
                            <img src={em.imageUrl} loading="lazy" className="w-full aspect-square object-contain p-1 bg-muted/10" />
                            <p className="text-[8px] text-center text-muted-foreground pb-0.5 truncate px-0.5">{em.name}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {clientEmblems.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Meus emblemas</p>
                        <div className="grid grid-cols-4 gap-2">
                          {clientEmblems.map(em => (
                            <button key={em.id} onClick={() => { placeEmblemFromUrl(em.imageUrl); setActiveTab(null); }} className="group rounded-lg border border-primary/40 overflow-hidden bg-background">
                              <img src={em.imageUrl} className="w-full aspect-square object-contain p-1 bg-muted/10" />
                              <p className="text-[8px] text-center text-muted-foreground pb-0.5 truncate px-0.5">{em.name}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div onClick={() => emblemInputRef.current?.click()} className="flex items-center gap-2 px-3 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <div><span className="text-xs text-muted-foreground">Enviar meu emblema</span></div>
                    </div>
                    <input ref={emblemInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleEmblemUpload} className="hidden" />
                  </div>
                )}
                {activeTab === 'logo' && (
                  <div className="space-y-3">
                    <div
                      onClick={() => setShowLogoNotice(true)}
                      className="flex items-center gap-3 px-4 py-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <div><span className="text-sm text-muted-foreground">Enviar logo ou imagem</span><span className="text-[10px] text-muted-foreground/60 block">PNG, JPG, SVG ou WebP</span></div>
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-border/30">
                  <Button variant="outline" size="sm" onClick={deleteSelected} className="w-full gap-1.5 text-destructive h-8 text-xs"><Trash2 className="h-3.5 w-3.5" /> Remover selecionado</Button>
                </div>
              </div>
            </div>
          )}

          {/* Canvas area */}
            <div className={`flex-1 flex flex-col overflow-hidden min-h-0 relative ${!selectedNiche?.backgroundImageUrl ? 'bg-gradient-to-b from-muted/50 to-muted/20' : ''} ${analyzingColors ? 'opacity-50 pointer-events-none' : ''}`}
              style={selectedNiche?.backgroundImageUrl ? {
                backgroundImage: `url(${selectedNiche.backgroundImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              } : undefined}>
              {selectedNiche?.backgroundImageUrl && (
                <div className="absolute inset-0 bg-background/50 pointer-events-none z-0" />
              )}
            {/* Desktop zoom bar */}
            <div className="hidden lg:flex items-center justify-center gap-3 py-1.5 px-4 bg-card/50 border-b border-border/30">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">{activeView === 'front' ? 'Frente' : 'Costas'}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveZoom(z => Math.max(0.3, Math.round((z - 0.15) * 100) / 100))}><ZoomOut className="h-3.5 w-3.5" /></Button>
              <Slider value={[activeZoom * 100]} onValueChange={([v]) => setActiveZoom(v / 100)} min={30} max={250} step={5} className="w-52" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveZoom(z => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}><ZoomIn className="h-3.5 w-3.5" /></Button>
              <span className="text-xs font-medium text-muted-foreground w-10 text-center">{Math.round(activeZoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setActiveZoom(1); const canvas = activeView === 'front' ? frontFabricRef.current : backFabricRef.current; if (canvas) { const vpt = canvas.viewportTransform!; vpt[4] = 0; vpt[5] = 0; canvas.requestRenderAll(); } }} title="Resetar zoom"><RotateCcw className="h-3.5 w-3.5" /></Button>
            </div>
            {/* Canvas container — single render, responsive display */}
            <div ref={mobileCanvasContainerRef} className="flex-1 overflow-hidden p-0 lg:p-4 flex items-center justify-center relative">
              <div className={`relative flex-shrink-0 lg:flex lg:gap-5 lg:items-center lg:justify-center ${!show2DEditor ? 'invisible absolute pointer-events-none' : ''}`}
                style={{ transform: `scale(${mobileScale})`, transformOrigin: 'center center' }}>
                <div ref={frontWrapRef}
                  className={`${activeView === 'front' ? 'block' : 'hidden lg:block'} ${activeView !== 'front' ? 'lg:opacity-50 lg:hover:opacity-75' : 'lg:ring-2 lg:ring-primary lg:ring-offset-2 lg:rounded-xl'} lg:cursor-pointer lg:transition-all lg:flex-shrink-0`}
                  onClick={() => setActiveView('front')}>
                  <p className="text-center text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wider hidden lg:block">Frente</p>
                  <div className="rounded-xl overflow-hidden"><canvas ref={frontCanvasRef} /></div>
                </div>
                <div ref={backWrapRef}
                  className={`${activeView === 'back' ? 'block' : 'hidden lg:block'} ${activeView !== 'back' ? 'lg:opacity-50 lg:hover:opacity-75' : 'lg:ring-2 lg:ring-primary lg:ring-offset-2 lg:rounded-xl'} lg:cursor-pointer lg:transition-all lg:flex-shrink-0`}
                  onClick={() => setActiveView('back')}>
                  <p className="text-center text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wider hidden lg:block">Costas</p>
                  <div className="rounded-xl overflow-hidden"><canvas ref={backCanvasRef} /></div>
                </div>
              </div>

              {/* 3D principal — sempre que o usuário não está editando em 2D.
                  Se não houver UV, mostra a camisa lisa (sem estampa). */}
              {!show2DEditor && (
                <div className="absolute inset-0 flex items-center justify-center p-2 lg:p-4">
                  <div className="w-full h-full max-w-3xl relative">
                    <Shirt3DPreview
                      frontImage={selectedTemplate.frontImageUrl}
                      backImage={selectedTemplate.backImageUrl}
                      uvMapUrl={effectiveUvUrl}
                      uvCanvas={uvZonesActive ? uvComposite.canvas : uv3DCanvas}
                      uvVersion={uvZonesActive ? uvComposite.version : uvTextureVersion}
                      cameraPosition={cameraPosition}
                      autoRotate={false}
                    />
                    
                    {/* View Controls - Integration directly in the main 3D view */}
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex flex-col h-[74px] w-[64px] p-0 shadow-xl border-2 border-primary/20 hover:border-primary bg-background/90 backdrop-blur rounded-xl group transition-all duration-200"
                        onClick={() => setCameraPosition([0, 0.1, 5.2])}
                      >
                        <div className="relative mb-0.5">
                          <Shirt className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tight text-foreground/80 group-hover:text-primary transition-colors">Frente</span>
                      </Button>

                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex flex-col h-[74px] w-[64px] p-0 shadow-xl border-2 border-primary/20 hover:border-primary bg-background/90 backdrop-blur rounded-xl group transition-all duration-200"
                        onClick={() => setCameraPosition([0, 0.1, -5.2])}
                      >
                        <div className="relative mb-0.5">
                          <Shirt className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" style={{ transform: 'scaleX(-1)' }} />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] flex items-center justify-center">
                            <span className="text-[7px] font-black text-primary/40 pointer-events-none">BACK</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tight text-foreground/80 group-hover:text-primary transition-colors">Costas</span>
                      </Button>

                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex flex-col h-[74px] w-[64px] p-0 shadow-xl border-2 border-primary/20 hover:border-primary bg-background/90 backdrop-blur rounded-xl group transition-all duration-200"
                        onClick={() => setCameraPosition([-5.2, 0.1, 0])}
                      >
                        <div className="relative mb-0.5">
                          <Shirt className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex items-center justify-center opacity-30">
                            <div className="w-1.5 h-3 border-l-2 border-primary rounded-l-full translate-x-[4px]" />
                          </div>
                        </div>
                        <span className="text-[9px] font-bold uppercase leading-[1] text-center px-0.5 flex flex-col text-foreground/80 group-hover:text-primary transition-colors">
                          <span>Lateral</span>
                          <span>Esquerda</span>
                        </span>
                      </Button>

                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex flex-col h-[74px] w-[64px] p-0 shadow-xl border-2 border-primary/20 hover:border-primary bg-background/90 backdrop-blur rounded-xl group transition-all duration-200"
                        onClick={() => setCameraPosition([5.2, 0.1, 0])}
                      >
                        <div className="relative mb-0.5">
                          <Shirt className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" style={{ transform: 'scaleX(-1)' }} />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex items-center justify-center opacity-30">
                            <div className="w-1.5 h-3 border-r-2 border-primary rounded-r-full -translate-x-[4px]" />
                          </div>
                        </div>
                        <span className="text-[9px] font-bold uppercase leading-[1] text-center px-0.5 flex flex-col text-foreground/80 group-hover:text-primary transition-colors">
                          <span>Lateral</span>
                          <span>Direita</span>
                        </span>
                      </Button>
                    </div>
                  </div>
                  {uvZonesActive && (
                    <>
                    {/* Toggle button — small, top-right, never covers the shirt */}
                    <button
                      onClick={() => setShowUvPanel(p => !p)}
                      className="absolute top-2 right-2 z-40 h-10 px-3 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center gap-1.5 text-xs font-bold active:scale-95"
                    >
                      <Sparkles className="h-4 w-4" />
                      {showUvPanel ? 'Fechar' : 'Personalizar'}
                    </button>
                    {showUvPanel && (
                    <div className="absolute inset-x-2 bottom-2 lg:inset-x-auto lg:top-14 lg:right-2 lg:bottom-2 lg:w-[320px] z-30 max-h-[60vh] lg:max-h-[80%] overflow-y-auto bg-card/95 backdrop-blur border border-border rounded-xl shadow-2xl p-3 space-y-3 animate-fade-in">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-4 w-4 text-accent" />
                        <p className="text-sm font-bold">Personalização UV</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground">Cor</label><input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                        <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground">Contorno</label><input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                        <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground">Esp.</label><Input type="number" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="h-7 w-16 text-xs" min={0} max={20} /></div>
                        <div className="flex items-center gap-1.5"><label className="text-[10px] text-muted-foreground">Tam.</label><Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="h-7 w-16 text-xs" min={8} max={220} /></div>
                      </div>
                      <Select value={fontFamily} onValueChange={setFontFamily}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Fonte" /></SelectTrigger><SelectContent className="max-h-60">{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} className="text-xs" style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent></Select>
                      {stamps.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-border/40">
                          <label className="text-[10px] text-muted-foreground uppercase font-semibold">Estampa</label>
                          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                            {stamps.map(s => (
                              <button
                                key={s.id}
                                onClick={() => addStamp(s)}
                                className={`flex-shrink-0 h-14 w-14 rounded-md border-2 overflow-hidden bg-muted transition-all ${appliedStamp?.id === s.id ? 'border-primary ring-2 ring-primary/30' : 'border-border/50 hover:border-primary/50'}`}
                                title={s.name}
                              >
                                <StampThumb stampUrl={s.imageUrl} name={s.name} />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {Object.keys(uvMapZones).map((zoneKey) => {
                        const layer = uvLayers.find(l => l.zoneKey === zoneKey && l.type === 'text') as Extract<UvLayer, { type: 'text' }> | undefined;
                        const imageLayer = uvLayers.find(l => l.zoneKey === zoneKey && l.type === 'image');
                        return (
                          <div key={zoneKey} className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{zoneKey}</label>
                            <Input
                              value={uvTextDrafts[zoneKey] ?? layer?.content ?? ''}
                              onChange={(e) => setUvLayerText(zoneKey, e.target.value)}
                              placeholder="Texto / nome / nº"
                              className="h-8 text-sm"
                            />
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="h-8 flex-1 gap-1 text-xs" onClick={() => document.getElementById(`uv-file-${zoneKey}`)?.click()}><Upload className="h-3.5 w-3.5" /> Logo</Button>
                              <Button variant="outline" size="sm" className="h-8 flex-1 gap-1 text-xs text-destructive" onClick={() => removeUvLayer(zoneKey)}><Trash2 className="h-3.5 w-3.5" /> Limpar</Button>
                            </div>
                            <input id={`uv-file-${zoneKey}`} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setUvLayerImage(zoneKey, file); e.currentTarget.value = ''; }} />
                            {imageLayer && <p className="text-[10px] text-muted-foreground">Logo/imagem aplicada</p>}
                          </div>
                        );
                      })}
                    </div>
                    )}
                    </>
                  )}
                </div>
              )}

              {/* Editor agora é 100% 3D — o canvas 2D continua existindo apenas
                  como fonte da textura UV (oculto) e nunca é exibido ao usuário. */}

              {/* Floating pan mode button — big and obvious for mobile users */}
              {activeZoom > 1 && (
                <div className="lg:hidden absolute bottom-3 right-3 flex flex-col items-center gap-2 z-20">
                  <button
                    onClick={() => {
                      setPanMode(prev => !prev);
                      // Deselect objects when entering pan mode
                      const canvas = activeView === 'front' ? frontFabricRef.current : backFabricRef.current;
                      if (!panMode && canvas) { canvas.discardActiveObject(); canvas.requestRenderAll(); }
                    }}
                    className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-xl text-sm font-bold transition-all active:scale-95 ${
                      panMode
                        ? 'bg-accent text-accent-foreground ring-2 ring-accent ring-offset-2'
                        : 'bg-sidebar text-sidebar-foreground'
                    }`}
                  >
                    <Hand className="h-5 w-5" />
                    {panMode ? 'Movendo ✓' : 'Mover Camisa'}
                  </button>
                  <button
                    onClick={() => {
                      setActiveZoom(1);
                      setPanMode(false);
                      const canvas = activeView === 'front' ? frontFabricRef.current : backFabricRef.current;
                      if (canvas) {
                        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                        canvas.requestRenderAll();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-destructive/90 text-destructive-foreground shadow-lg text-xs font-medium active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Resetar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botões 2D removidos do mobile. */}
      </div>

      {/* Patch side + zone picker modal */}
      {pendingPatch && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{!patchSideChoice ? `Onde aplicar?` : 'Escolha a zona'}</h3>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
              <div className="h-12 w-12 rounded bg-center bg-contain bg-no-repeat select-none"
                style={{ backgroundImage: `url(${pendingPatch.imageUrl})` }} onContextMenu={e => e.preventDefault()} draggable={false} />
              <div>
                <p className="text-sm font-medium">{pendingPatch.name}</p>
                {patchSideChoice && (
                  <p className="text-[10px] text-muted-foreground">
                    Lado: {patchSideChoice === 'front' ? 'Frente' : patchSideChoice === 'back' ? 'Costas' : 'Ambos'}
                  </p>
                )}
              </div>
            </div>
            {!patchSideChoice && (
              <div className="space-y-2 mb-4">
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handlePatchSideSelect('front')}>
                  <Shirt className="h-4 w-4" /> Apenas Frente
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handlePatchSideSelect('back')}>
                  <Shirt className="h-4 w-4" /> Apenas Costas
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handlePatchSideSelect('both')}>
                  <Shirt className="h-4 w-4" /> Frente e Costas
                </Button>
              </div>
            )}
            {patchSideChoice && (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {patchAvailableZones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma zona configurada para este lado</p>
                ) : (
                  patchAvailableZones.map(zone => (
                    <Button key={zone.id} variant="outline" className="w-full justify-start gap-2" onClick={() => addPatchToZone(pendingPatch, zone)}>
                      <MapPin className="h-3.5 w-3.5" />
                      {zone.name}
                      <span className="text-[10px] text-muted-foreground ml-auto">{zone.shared ? 'Compartilhada' : zone.side === 'front' ? 'Frente' : 'Costas'}</span>
                    </Button>
                  ))
                )}
              </div>
            )}
            <div className="flex gap-2">
              {patchSideChoice && (
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setPatchSideChoice(null)}>← Voltar</Button>
              )}
              <Button variant="ghost" size="sm" className={patchSideChoice ? '' : 'w-full'} onClick={() => { setPendingPatch(null); setPatchSideChoice(null); }}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Zone picker modal */}
      {showZonePicker && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Onde posicionar?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Escolha a zona onde {showZonePicker === 'text' ? 'o texto' : 'a logo'} será posicionado(a):
            </p>
            <div className="space-y-2 mb-4">
              {templateZones.filter(z => !z.patchOnly && zoneMatchesSide(z, activeView)).map(zone => (
                <Button key={zone.id} variant="outline" className="w-full justify-start gap-2" onClick={() => {
                  if (showZonePicker === 'text') addTextAtZone(zone);
                  else if (pendingLogoFile) placeLogoFile(pendingLogoFile, zone);
                }}>
                  <MapPin className="h-3.5 w-3.5" />
                  {zone.name}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => {
                if (showZonePicker === 'text') addTextAtZone();
                else if (pendingLogoFile) placeLogoFile(pendingLogoFile);
              }}>Posição livre</Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowZonePicker(null); setPendingLogoFile(null); }}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Text styles full-screen overlay */}
      {showTextStylesOverlay && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">Estilos de Texto</h3>
            </div>
            <button onClick={() => setShowTextStylesOverlay(false)} className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground mb-4">Toque em um estilo para aplicá-lo na camisa</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {textStyles.map(ts => (
                <button key={ts.id} onClick={() => { selectTextStyle(ts); setShowTextStylesOverlay(false); }} className="group rounded-xl border-2 border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all bg-card" title={ts.name}>
                  <img src={ts.imageUrl} alt={ts.name} className="w-full aspect-video object-contain p-2 bg-muted/20 protected-img" />
                  <p className="text-sm text-center text-muted-foreground py-2 truncate px-2 font-medium group-hover:text-primary transition-colors">{ts.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logo quality notice modal */}
      {showLogoNotice && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-xl font-bold text-center mb-4">Fique Tranquilo!</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              O seu desenho passará por especialistas em tratamento de imagem para garantir a qualidade de impressão no produto.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => { setShowLogoNotice(false); logoInputRef.current?.click(); }} className="px-6">
                Ok
              </Button>
            </div>
          </div>
        </div>
      )}
      {guideEnabled && <EditorGuide step={guideStep} onSkip={skipGuideStep} onDismissAll={dismissGuide} />}

      <Dialog open={show3D} onOpenChange={setShow3D}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] p-4 flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="h-5 w-5 text-primary" />
              Pré-visualização da camisa
            </DialogTitle>
          </DialogHeader>
          {preview3D && (
            <Preview3DTabs
              front={preview3D.front}
              back={preview3D.back}
              uvMapUrl={selectedTemplate?.uvMapUrl ?? null}
              cameraPosition={cameraPosition}
              onCameraChange={setCameraPosition}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShirtEditor;
