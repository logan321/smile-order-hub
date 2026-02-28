import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, FabricText, Textbox, FabricImage, Point, Polygon, FabricObject, Control, controlsUtils } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, Move, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt, Sparkles, X, Hand } from 'lucide-react';
import EditorGuide, { type GuideStep } from '@/components/EditorGuide';
import { Shadow } from 'fabric';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';
import { toProxyUrl } from '@/lib/imageProxy';
import { fetchAllStampColors, StampColor } from '@/hooks/useStampColors';


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
  userId: string;
  nicheId: string | null;
}

interface Stamp {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  backImageUrl: string | null;
}

type ToolbarTab = 'stamps' | 'text' | 'logo' | 'patches' | 'textStyles' | null;
type PatchSideChoice = 'front' | 'back' | 'both' | null;

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 625;

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
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [strokeColor, setStrokeColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(4);
  const [textStyles, setTextStyles] = useState<{ id: string; name: string; category: string; imageUrl: string }[]>([]);
  const [selectedTextStyle, setSelectedTextStyle] = useState<{ name: string; imageUrl: string } | null>(null);
  const [stampColors, setStampColors] = useState<StampColor[]>([]);
  const [appliedStamp, setAppliedStamp] = useState<Stamp | null>(null);
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

  const { zones: templateZones } = useTemplateZones(selectedTemplate?.id);

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
      const [templatesRes, stampsRes, patchesRes, textStylesRes, nichesRes] = await Promise.all([
        supabase.from('shirt_templates').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('stamp_catalog').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('patch_catalog').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('text_styles').select('*').eq('active', true).eq('user_id', ownerUserId),
        supabase.from('niches').select('*').eq('user_id', ownerUserId).order('position', { ascending: true }),
      ]);
      const allT = (templatesRes.data as any[])?.map(t => ({
        id: t.id, name: t.name, frontImageUrl: t.front_image_url, backImageUrl: t.back_image_url, userId: t.user_id, nicheId: t.niche_id ?? null,
      })) ?? [];
      setAllTemplates(allT);
      setTemplates(allT);
      const allS = (stampsRes.data as any[])?.map(s => ({
        id: s.id, name: s.name, category: s.category, imageUrl: s.image_url, backImageUrl: s.back_image_url ?? null,
      })) ?? [];
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
    const zonesForSide = templateZones.filter(z => !z.patchOnly && (z.side === activeView || z.shared));
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
    const useBack = zone.shared && zone.side !== side;
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
        templateZones.find(z => z.patchOnly && targetName && z.name.toLowerCase() === targetName && (z.side === s || z.shared)) ||
        templateZones.find(z => z.patchOnly && (z.side === s || z.shared)) ||
        templateZones.find(z => targetName && z.name.toLowerCase() === targetName && (z.side === s || z.shared)) ||
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
      const zone = templateZones.find(z => z.patchOnly && targetName && z.name.toLowerCase() === targetName && (z.side === side || z.shared))
        || templateZones.find(z => z.patchOnly && (z.side === side || z.shared))
        || templateZones.find(z => targetName && z.name.toLowerCase() === targetName && (z.side === side || z.shared))
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
        return z.side === patchSideChoice || z.shared;
      })
    : [];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const zonesForSide = templateZones.filter(z => !z.patchOnly && (z.side === activeView || z.shared));
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
        active.dirty = true;
        active.setCoords();
        canvas.requestRenderAll();
      };
      applyFont();
    }
  }, [textColor, strokeColor, strokeWidth, fontSize, fontFamily, shadowEnabled, shadowColor, shadowBlur, activeView]);

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

    const { data } = await supabase.from('user_settings').select('whatsapp_number').eq('user_id', ownerUserId).maybeSingle();
    const whatsappNumber = data?.whatsapp_number?.replace(/\D/g, '') || '';

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

  // ─── Toolbar tab items ────────────────────────────────────────
  const toolbarTabs: { id: ToolbarTab; label: string; icon: React.ReactNode }[] = [
    { id: 'stamps', label: 'Estampas', icon: <Shirt className="h-5 w-5 lg:h-5 lg:w-5" /> },
    { id: 'patches', label: currentPatchLabel, icon: <Sparkles className="h-5 w-5 lg:h-5 lg:w-5" /> },
    { id: 'text', label: 'Texto', icon: <Type className="h-5 w-5 lg:h-5 lg:w-5" /> },
    { id: 'logo', label: 'Logo / Imagem', icon: <Upload className="h-5 w-5 lg:h-5 lg:w-5" /> },
  ];

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
        </div>
      </header>

      {/* Unified responsive layout */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Top toolbar — tabs + view toggle + zoom */}
        <div className="border-b border-border bg-card/90 backdrop-blur-sm shrink-0">
          {/* Desktop: horizontal tab bar */}
          <div className="hidden lg:flex items-center justify-center gap-1 px-2">
            {toolbarTabs.map(tab => (
              <button key={tab.id} onClick={() => {
                  setActiveTab(activeTab === tab.id ? null : tab.id);
                  if (tab.id === 'stamps') advanceGuide('stamps-tab', 'stamp-pick');
                  if (tab.id === 'patches') advanceGuide('patches-tab', 'patch-pick');
                  if (tab.id === 'text') advanceGuide('text-tab', 'text-pick');
                  if (tab.id === 'logo') advanceGuide('logo-tab', 'budget');
                }}
                data-guide-desktop={tab.id === 'stamps' ? 'stamps-tab' : tab.id === 'patches' ? 'patches-tab' : tab.id === 'text' ? 'text-tab' : tab.id === 'logo' ? 'logo-tab' : undefined}
                className={`flex flex-col items-center gap-0.5 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-all border-b-3 ${activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 pr-2">
              <div className="flex items-center rounded-full overflow-hidden shadow-sm border-2 border-accent/40">
                <Button variant={activeView === 'front' ? 'default' : 'ghost'} size="sm" className={`h-8 text-xs px-4 rounded-full ${activeView === 'front' ? 'bg-accent text-accent-foreground' : ''}`} onClick={() => setActiveView('front')}>Frente</Button>
                <Button variant={activeView === 'back' ? 'default' : 'ghost'} size="sm" className={`h-8 text-xs px-4 rounded-full ${activeView === 'back' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setActiveView('back')}>Costas</Button>
              </div>
            </div>
          </div>
          {/* Mobile: view toggle + zoom — vibrant style */}
          <div className="lg:hidden flex items-center justify-between px-3 py-2.5 bg-sidebar/5">
            <div className="flex items-center rounded-full overflow-hidden shadow-sm border-2 border-accent/50">
              <button onClick={() => setActiveView('front')} className={`px-6 py-2 text-sm font-bold transition-all ${activeView === 'front' ? 'bg-accent text-accent-foreground shadow-inner' : 'bg-card text-muted-foreground hover:text-foreground'}`}>Frente</button>
              <button onClick={() => setActiveView('back')} className={`px-6 py-2 text-sm font-bold transition-all ${activeView === 'back' ? 'bg-primary text-primary-foreground shadow-inner' : 'bg-card text-muted-foreground hover:text-foreground'}`}>Costas</button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setActiveZoom(z => Math.max(0.3, Math.round((z - 0.15) * 100) / 100))}><ZoomOut className="h-4 w-4" /></Button>
              <span className="text-xs font-bold text-muted-foreground w-10 text-center">{Math.round(activeZoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setActiveZoom(z => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setActiveZoom(1); const canvas = activeView === 'front' ? frontFabricRef.current : backFabricRef.current; if (canvas) { const vpt = canvas.viewportTransform!; vpt[4] = 0; vpt[5] = 0; canvas.requestRenderAll(); } }}><RotateCcw className="h-4 w-4" /></Button>
            </div>
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
                          <img src={s.imageUrl} alt={s.name} loading="lazy" decoding="async" className="w-full aspect-[3/4] object-contain p-1 protected-img" />
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
            </aside>
          )}

          {/* Mobile overlay panel — opens on top of canvas */}
          {activeTab && (
            <div className="lg:hidden absolute inset-x-0 bottom-0 z-30 bg-card border-t-2 border-accent rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.2)] max-h-[45vh] flex flex-col animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <p className="text-sm font-bold text-foreground">
                  {activeTab === 'stamps' ? '🎨 Estampas' : activeTab === 'patches' ? `🏷️ ${currentPatchLabel}` : activeTab === 'text' ? '✏️ Texto' : activeTab === 'logo' ? '📤 Logo / Imagem' : ''}
                </p>
                <button onClick={() => setActiveTab(null)} className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {activeTab === 'stamps' && (
                  <div>
                    {stamps.length === 0 ? (<p className="text-xs text-muted-foreground py-4 text-center">Nenhuma estampa disponível</p>) : (
                      <div className="grid grid-cols-4 gap-2" data-guide-mobile="stamp-pick">
                        {stamps.map(s => (
                          <button key={s.id} onClick={() => { addStamp(s); }} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all bg-background" title={s.name}>
                            <img src={s.imageUrl} alt={s.name} loading="lazy" decoding="async" className="w-full aspect-[3/4] object-contain p-0.5 protected-img" />
                            <p className="text-[8px] text-center text-muted-foreground pb-0.5 truncate px-0.5">{s.name}</p>
                          </button>
                        ))}
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
            <div className={`flex-1 flex flex-col overflow-hidden min-h-0 relative ${!selectedNiche?.backgroundImageUrl ? 'bg-gradient-to-b from-muted/50 to-muted/20' : ''}`}
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
              <div className="relative flex-shrink-0 lg:flex lg:gap-5 lg:items-center lg:justify-center"
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

        {/* Mobile bottom tab bar — vibrant, large icons like Jumptec */}
        <div className="lg:hidden border-t-2 border-sidebar bg-sidebar flex items-stretch shadow-[0_-4px_16px_rgba(0,0,0,0.2)] shrink-0">
          {toolbarTabs.map(tab => (
            <button key={tab.id} onClick={() => {
                setActiveTab(activeTab === tab.id ? null : tab.id);
                if (tab.id === 'stamps') advanceGuide('stamps-tab', 'stamp-pick');
                if (tab.id === 'patches') advanceGuide('patches-tab', 'patch-pick');
                if (tab.id === 'text') advanceGuide('text-tab', 'text-pick');
                if (tab.id === 'logo') advanceGuide('logo-tab', 'budget');
              }}
              data-guide-mobile={tab.id === 'stamps' ? 'stamps-tab' : tab.id === 'patches' ? 'patches-tab' : tab.id === 'text' ? 'text-tab' : tab.id === 'logo' ? 'logo-tab' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-bold transition-all ${activeTab === tab.id ? 'text-accent bg-sidebar-accent' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'}`}>
              <span className={`[&_svg]:h-7 [&_svg]:w-7 p-1.5 rounded-xl transition-all ${activeTab === tab.id ? 'bg-accent text-accent-foreground shadow-md scale-110' : ''}`}>{tab.icon}</span>
              <span className="text-[11px]">{tab.label}</span>
            </button>
          ))}
        </div>
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
                  <Shirt className="h-4 w-4 rotate-180" /> Apenas Costas
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
              {templateZones.filter(z => !z.patchOnly && (z.side === activeView || z.shared)).map(zone => (
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
    </div>
  );
};

export default ShirtEditor;
