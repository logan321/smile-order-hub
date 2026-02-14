import { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, FabricText, Textbox, FabricImage, Point, Polygon, Path } from 'fabric';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt, MessageCircle, Fish, WrapText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';

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

// Load Google Fonts on demand
const loadedFonts = new Set<string>();
const loadGoogleFont = (fontName: string): Promise<void> => {
  if (loadedFonts.has(fontName)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}&display=swap`;
    link.rel = 'stylesheet';
    link.onload = () => {
      loadedFonts.add(fontName);
      document.fonts.ready.then(() => resolve());
    };
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
};

interface Template {
  id: string;
  name: string;
  frontImageUrl: string;
  backImageUrl: string;
  userId: string;
}

interface Stamp {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  backImageUrl: string | null;
}

type ToolbarTab = 'stamps' | 'text' | 'logo' | 'patches' | null;
type PatchSideChoice = 'front' | 'back' | 'both' | null;

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 625;

const ShirtEditor = () => {
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontFabricRef = useRef<Canvas | null>(null);
  const backFabricRef = useRef<Canvas | null>(null);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState<ToolbarTab>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [patches, setPatches] = useState<{ id: string; name: string; imageUrl: string; targetZoneName: string }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [strokeColor, setStrokeColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [textCurve, setTextCurve] = useState(0); // -100 to 100, 0 = flat
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [showZonePicker, setShowZonePicker] = useState<'text' | 'logo' | null>(null);
  const [pendingPatch, setPendingPatch] = useState<{ id: string; name: string; imageUrl: string; targetZoneName: string } | null>(null);
  const [patchSideChoice, setPatchSideChoice] = useState<'front' | 'back' | 'both' | null>(null);
  const [frontZoom, setFrontZoom] = useState(1);
  const [backZoom, setBackZoom] = useState(1);
  const isPanningRef = useRef(false);
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);
  const frontWrapRef = useRef<HTMLDivElement>(null);
  const backWrapRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileCanvasContainerRef = useRef<HTMLDivElement>(null);
  const [mobileScale, setMobileScale] = useState(1);

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

  // Fetch templates and stamps
  useEffect(() => {
    const fetchData = async () => {
      const [templatesRes, stampsRes, patchesRes] = await Promise.all([
        supabase.from('shirt_templates').select('*').eq('active', true),
        supabase.from('stamp_catalog').select('*').eq('active', true),
        supabase.from('patch_catalog').select('*').eq('active', true),
      ]);
      setTemplates((templatesRes.data as any[])?.map(t => ({
        id: t.id, name: t.name, frontImageUrl: t.front_image_url, backImageUrl: t.back_image_url, userId: t.user_id,
      })) ?? []);
      setStamps((stampsRes.data as any[])?.map(s => ({
        id: s.id, name: s.name, category: s.category, imageUrl: s.image_url, backImageUrl: s.back_image_url ?? null,
      })) ?? []);
      setPatches((patchesRes.data as any[])?.map(p => ({
        id: p.id, name: p.name, imageUrl: p.image_url, targetZoneName: p.target_zone_name,
      })) ?? []);
      setLoading(false);
    };
    fetchData();
  }, []);

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
      width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: '#f5f5f5',
      selection: true, enableRetinaScaling: true, imageSmoothingEnabled: true,
    });
    frontFabricRef.current = frontCanvas;

    const backCanvas = new Canvas(backCanvasRef.current, {
      width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: '#f5f5f5',
      selection: true, enableRetinaScaling: true, imageSmoothingEnabled: true,
    });
    backFabricRef.current = backCanvas;

    loadBackground(frontCanvas, selectedTemplate.frontImageUrl, 'front');
    loadBackground(backCanvas, selectedTemplate.backImageUrl, 'back');

    return () => {
      frontCanvas.dispose(); backCanvas.dispose();
      frontFabricRef.current = null; backFabricRef.current = null;
      frontStampRef.current = null; backStampRef.current = null;
      frontClipRef.current = null; backClipRef.current = null;
    };
  }, [selectedTemplate, loadBackground]);

  const activeZoom = activeView === 'front' ? frontZoom : backZoom;
  const setActiveZoom = activeView === 'front' ? setFrontZoom : setBackZoom;

  // Apply zoom
  useEffect(() => {
    const canvas = activeView === 'front' ? frontFabricRef.current : backFabricRef.current;
    if (!canvas) return;
    const zoom = activeView === 'front' ? frontZoom : backZoom;
    canvas.zoomToPoint(new Point(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2), zoom);
    canvas.setDimensions({ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom });
    canvas.requestRenderAll();
  }, [frontZoom, backZoom, activeView]);

  // Pan + wheel zoom
  useEffect(() => {
    const front = frontFabricRef.current;
    const back = backFabricRef.current;
    if (!front || !back) return;

    const setupPan = (canvas: Canvas, side: 'front' | 'back') => {
      canvas.on('mouse:down', (opt) => {
        const evt = opt.e as MouseEvent;
        if (evt.altKey || evt.button === 1) {
          isPanningRef.current = true;
          lastPanPoint.current = { x: evt.clientX, y: evt.clientY };
          canvas.selection = false;
          evt.preventDefault(); evt.stopPropagation();
        }
      });
      canvas.on('mouse:move', (opt) => {
        if (!isPanningRef.current || !lastPanPoint.current) return;
        const evt = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform!;
        vpt[4] += evt.clientX - lastPanPoint.current.x;
        vpt[5] += evt.clientY - lastPanPoint.current.y;
        lastPanPoint.current = { x: evt.clientX, y: evt.clientY };
        canvas.requestRenderAll();
      });
      canvas.on('mouse:up', () => {
        if (isPanningRef.current) {
          isPanningRef.current = false; lastPanPoint.current = null; canvas.selection = true;
        }
      });
      canvas.on('mouse:wheel', (opt) => {
        const evt = opt.e as WheelEvent;
        evt.preventDefault(); evt.stopPropagation();
        const pointer = canvas.getViewportPoint(evt);
        let newZoom = canvas.getZoom() * (1 - evt.deltaY / 400);
        newZoom = Math.max(0.3, Math.min(2.5, newZoom));
        canvas.zoomToPoint(pointer, newZoom);
        canvas.setDimensions({ width: CANVAS_WIDTH * newZoom, height: CANVAS_HEIGHT * newZoom });
        if (side === 'front') setFrontZoom(newZoom); else setBackZoom(newZoom);
      });
    };
    setupPan(front, 'front');
    setupPan(back, 'back');
    return () => {
      front.off('mouse:down'); front.off('mouse:move'); front.off('mouse:up'); front.off('mouse:wheel');
      back.off('mouse:down'); back.off('mouse:move'); back.off('mouse:up'); back.off('mouse:wheel');
    };
  }, [selectedTemplate]);

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
      const containerWidth = container.clientWidth - 16;
      const containerHeight = container.clientHeight - 16;
      const scaleW = containerWidth / CANVAS_WIDTH;
      const scaleH = containerHeight / CANVAS_HEIGHT;
      setMobileScale(Math.min(scaleW, scaleH, 1));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(container);
    window.addEventListener('resize', updateScale);
    return () => { ro.disconnect(); window.removeEventListener('resize', updateScale); };
  }, [selectedTemplate]);

  const handleSelectTemplate = (template: Template) => {
    if (frontFabricRef.current) { frontFabricRef.current.dispose(); frontFabricRef.current = null; }
    if (backFabricRef.current) { backFabricRef.current.dispose(); backFabricRef.current = null; }
    frontStampRef.current = null; backStampRef.current = null;
    frontClipRef.current = null; backClipRef.current = null;
    setActiveView('front');
    setSelectedTemplate(template);
  };

  // Helper to add a text object to a specific canvas+side with zone coords
  // Build an arc path for curved text
  const buildArcPath = (curve: number, textWidth: number): { path: Path; startOffset: number } | undefined => {
    if (curve === 0) return undefined;
    const absCurve = Math.abs(curve);
    const radius = Math.max(80, 1200 - absCurve * 10);
    const halfW = Math.max(textWidth * 0.6, 100);
    const sweep = curve > 0 ? 1 : 0;
    // Center the path at 0,0 so text renders symmetrically
    const pathStr = `M ${-halfW},0 A ${radius},${radius} 0 0 ${sweep} ${halfW},0`;
    const p = new Path(pathStr, { visible: false, fill: '', stroke: '' });
    // Approximate arc length: θ * r where θ = 2 * arcsin(halfW / radius)
    const theta = 2 * Math.asin(Math.min(halfW / radius, 1));
    const pathLength = theta * radius;
    const startOffset = Math.max(0, (pathLength - textWidth) / 2);
    return { path: p, startOffset };
  };

  // Apply curve to an existing text object in real-time, preserving position
  const applyCurveToObject = (obj: FabricText, curve: number, canvas: Canvas) => {
    // Store original position on first curve application
    if ((obj as any)._origCurveLeft === undefined) {
      (obj as any)._origCurveLeft = obj.left;
      (obj as any)._origCurveTop = obj.top;
      (obj as any)._origOriginX = obj.originX;
      (obj as any)._origOriginY = obj.originY;
    }

    const result = buildArcPath(curve, obj.width || 200);
    if (result) {
      (obj as any).set({ path: result.path, pathStartOffset: result.startOffset });
    } else {
      (obj as any).set({ path: undefined, pathStartOffset: 0 });
    }
    (obj as any)._curveValue = curve;

    // Always restore to the original stored position
    obj.set({
      left: (obj as any)._origCurveLeft,
      top: (obj as any)._origCurveTop,
      originX: (obj as any)._origOriginX,
      originY: (obj as any)._origOriginY,
    });
    obj.setCoords();
    canvas.requestRenderAll();
  };

  const addTextToCanvas = async (canvas: Canvas, side: 'front' | 'back', zone?: TemplateZone) => {
    const clipPath = side === 'front' ? frontClipRef.current : backClipRef.current;
    const fontDef = FONT_OPTIONS.find(f => f.value === fontFamily);
    if (fontDef?.google) await loadGoogleFont(fontFamily);

    const isMultiline = textInput.includes('\n');

    // Use Textbox for multiline, FabricText for single line
    let text: FabricText | Textbox;
    if (isMultiline) {
      text = new Textbox(textInput, {
        fontSize, fill: textColor, fontFamily,
        stroke: strokeWidth > 0 ? strokeColor : undefined,
        strokeWidth: strokeWidth > 0 ? strokeWidth : 0,
        width: 300,
        textAlign: 'center',
      });
    } else {
      text = new FabricText(textInput, {
        fontSize, fill: textColor, fontFamily,
        stroke: strokeWidth > 0 ? strokeColor : undefined,
        strokeWidth: strokeWidth > 0 ? strokeWidth : 0,
      });
    }

    // Apply arc path if curved
    if (textCurve !== 0) {
      const result = buildArcPath(textCurve, text.width || 200);
      if (result) {
        (text as any).set({ path: result.path, pathStartOffset: result.startOffset });
      }
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
    (text as any)._curveValue = textCurve;
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
  };

  const handleAddTextClick = () => {
    if (!textInput.trim()) return;
    const zonesForSide = templateZones.filter(z => z.side === activeView || z.shared);
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
        applyStampToCanvas(frontCanvas, stamp.imageUrl, 'front'),
        applyStampToCanvas(backCanvas, backUrl, 'back'),
      ]);
      toast.success(`Estampa "${stamp.name}" aplicada!`);
    } catch (err) {
      console.error('Erro ao aplicar estampa:', err);
      toast.error('Erro ao aplicar estampa');
    }
  };

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
        (img as any)._zoneClipData = coords.pathData; // store for reference
        canvas.add(img);
        canvas.renderAll();
      } catch {
        toast.error('Erro ao carregar imagem do peixe');
      }
    }
    toast.success(`Peixe "${patch.name}" aplicado em "${zone.name}"!`);
    setPendingPatch(null);
    setPatchSideChoice(null);
  };

  const handlePatchClick = (patch: { id: string; name: string; imageUrl: string; targetZoneName: string }) => {
    setPendingPatch(patch);
    setPatchSideChoice(null);
  };

  const handlePatchSideSelect = async (side: 'front' | 'back' | 'both') => {
    if (!pendingPatch) return;

    // Try to auto-apply using targetZoneName or find matching zones for the chosen side(s)
    const targetName = pendingPatch.targetZoneName?.trim().toLowerCase();

    if (side === 'both') {
      // Find zones for front and back
      // Priority: 1) exact targetZoneName match on that side, 2) any zone native to that side, 3) shared zone
      const findZoneForSide = (s: 'front' | 'back') =>
        templateZones.find(z => targetName && z.name.toLowerCase() === targetName && z.side === s) ||
        templateZones.find(z => targetName && z.name.toLowerCase() === targetName && z.shared) ||
        templateZones.find(z => z.side === s) ||
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
        toast.success(`Peixe "${pendingPatch.name}" aplicado em ${applied.join(' e ')}!`);
        setPendingPatch(null);
        setPatchSideChoice(null);
        return;
      }
    } else {
      // Single side - find matching zone (prefer native side, then shared)
      const zone = templateZones.find(z => targetName && z.name.toLowerCase() === targetName && z.side === side)
        || templateZones.find(z => targetName && z.name.toLowerCase() === targetName && z.shared)
        || templateZones.find(z => z.side === side)
        || templateZones.find(z => z.shared);

      if (zone) {
        await addPatchToSide(pendingPatch, zone, side);
        toast.success(`Peixe "${pendingPatch.name}" aplicado em "${zone.name}"!`);
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
      const img = await FabricImage.fromURL(patch.imageUrl, { crossOrigin: 'anonymous' });
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
    const zonesForSide = templateZones.filter(z => z.side === activeView || z.shared);
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
    if (zoneClipData) (img as any)._zoneClipData = zoneClipData;
    canvas.add(img);
    return img;
  };

  const placeLogoFile = (file: File, zone?: TemplateZone) => {
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

  // Live-update text style
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
        });
        // Apply curve in real-time
        applyCurveToObject(active as FabricText, textCurve, canvas);
      };
      applyFont();
    }
  }, [textColor, strokeColor, strokeWidth, fontSize, fontFamily, textCurve, activeView]);

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
        setTextCurve((active as any)._curveValue || 0);
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

  // WhatsApp quote
  const handleWhatsAppQuote = () => {
    const templateName = selectedTemplate?.name || 'Camisa personalizada';
    const message = encodeURIComponent(
      `Olá! Gostaria de fazer um orçamento para:\n\n` +
      `🎽 Modelo: ${templateName}\n` +
      `📋 Personalização feita no editor online\n\n` +
      `Poderia me enviar mais informações sobre valores e prazos?`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  // ─── Template selection screen ────────────────────────────────
  if (!selectedTemplate) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <img src={logo} alt="Logo" className="h-10 w-auto mx-auto mb-3" />
            <h1 className="text-2xl font-bold font-display">Editor de Camisas</h1>
            <p className="text-muted-foreground mt-1">Escolha um modelo para personalizar</p>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground">Carregando templates...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum template disponível</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className="group rounded-xl border border-border/50 bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="grid grid-cols-2 gap-1 p-2">
                    <img src={t.frontImageUrl} alt="Frente" className="w-full aspect-[3/4] object-contain rounded bg-muted/30" />
                    <img src={t.backImageUrl} alt="Costas" className="w-full aspect-[3/4] object-contain rounded bg-muted/30" />
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
      </div>
    );
  }

  // ─── Toolbar tab items ────────────────────────────────────────
  const toolbarTabs: { id: ToolbarTab; label: string; icon: React.ReactNode }[] = [
    { id: 'stamps', label: 'Estampas', icon: <Shirt className="h-5 w-5" /> },
    { id: 'patches', label: 'Peixes', icon: <Fish className="h-5 w-5" /> },
    { id: 'text', label: 'Texto', icon: <Type className="h-5 w-5" /> },
    { id: 'logo', label: 'Logo / Imagem', icon: <Upload className="h-5 w-5" /> },
  ];

  // ─── Editor screen ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header — compact on mobile */}
      <header className="border-b border-border bg-card px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)} className="h-8 px-2">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Voltar</span>
          </Button>
          <span className="text-sm font-medium truncate max-w-[120px] sm:max-w-none">{selectedTemplate.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={handleWhatsAppQuote} className="gap-1 text-primary border-primary/30 hover:bg-primary/5 h-8 px-2 sm:px-3">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Orçamento</span>
          </Button>
          <Button onClick={handleDownload} disabled={downloading} size="sm" className="gap-1 h-8 px-2 sm:px-3">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{downloading ? 'Baixando...' : 'Baixar'}</span>
          </Button>
        </div>
      </header>

      {/* Unified responsive layout */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top toolbar — tabs + view toggle + zoom */}
        <div className="border-b border-border bg-card">
          {/* Desktop: horizontal tab bar */}
          <div className="hidden lg:flex items-center justify-center gap-1 px-2">
            {toolbarTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(activeTab === tab.id ? null : tab.id)}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 pr-2">
              <Button variant={activeView === 'front' ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-3" onClick={() => setActiveView('front')}>Frente</Button>
              <Button variant={activeView === 'back' ? 'default' : 'outline'} size="sm" className="h-7 text-xs px-3" onClick={() => setActiveView('back')}>Costas</Button>
            </div>
          </div>
          {/* Mobile: view toggle + zoom */}
          <div className="lg:hidden flex items-center justify-between px-3 py-2">
            <div className="flex items-center rounded-lg overflow-hidden border border-border">
              <button onClick={() => setActiveView('front')} className={`px-5 py-1.5 text-sm font-semibold transition-colors ${activeView === 'front' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>Frente</button>
              <button onClick={() => setActiveView('back')} className={`px-5 py-1.5 text-sm font-semibold transition-colors ${activeView === 'back' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>Costas</button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveZoom(z => Math.max(0.3, Math.round((z - 0.15) * 100) / 100))}><ZoomOut className="h-3.5 w-3.5" /></Button>
              <span className="text-[10px] font-medium text-muted-foreground w-8 text-center">{Math.round(activeZoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveZoom(z => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}><ZoomIn className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setActiveZoom(1); const canvas = activeView === 'front' ? frontFabricRef.current : backFabricRef.current; if (canvas) { const vpt = canvas.viewportTransform!; vpt[4] = 0; vpt[5] = 0; canvas.requestRenderAll(); } }}><RotateCcw className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Sidebar panel — on mobile: bottom slide-up, on desktop: left sidebar */}
          {activeTab && (
            <aside className="order-2 lg:order-1 lg:w-64 border-t lg:border-t-0 lg:border-r border-border bg-card p-3 overflow-y-auto max-h-[30vh] lg:max-h-none">
              {activeTab === 'stamps' && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Escolha uma estampa</p>
                  {stamps.length === 0 ? (<p className="text-xs text-muted-foreground py-4 text-center">Nenhuma estampa disponível</p>) : (
                    <div className="grid grid-cols-4 lg:grid-cols-3 gap-2">
                      {stamps.map(s => (
                        <button key={s.id} onClick={() => addStamp(s)} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all bg-background" title={s.name}>
                          <img src={s.imageUrl} alt={s.name} className="w-full aspect-[3/4] object-contain p-0.5 lg:p-1" />
                          <p className="text-[8px] lg:text-[9px] text-center text-muted-foreground pb-0.5 truncate px-0.5 group-hover:text-primary transition-colors">{s.name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'patches' && (
                <div className="patch-protected">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Peixes da Empresa</p>
                  {patches.length === 0 ? (<p className="text-xs text-muted-foreground py-4 text-center">Nenhum peixe disponível</p>) : (
                    <div className="grid grid-cols-4 lg:grid-cols-3 gap-2">
                      {patches.map(p => (
                        <button key={p.id} onClick={() => handlePatchClick(p)} className="group rounded-lg border border-border/50 overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all bg-background relative" title={p.name} onContextMenu={e => e.preventDefault()}>
                          <div className="w-full aspect-square p-0.5 lg:p-1 bg-center bg-contain bg-no-repeat select-none" style={{ backgroundImage: `url(${p.imageUrl})` }} draggable={false} aria-hidden="true" />
                          <div className="absolute inset-0" onDragStart={e => e.preventDefault()} />
                          <div className="pb-0.5 px-0.5 relative z-10"><p className="text-[8px] lg:text-[9px] text-center text-muted-foreground truncate group-hover:text-primary transition-colors select-none">{p.name}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'text' && (
                <div className="space-y-2 lg:space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase hidden lg:block">Adicionar texto</p>
                  <Textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Digite o texto... (Enter para quebrar linha)" className="min-h-[60px] text-sm resize-none" rows={2} />
                  <div className="flex gap-2">
                    <Select value={fontFamily} onValueChange={setFontFamily}><SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Fonte" /></SelectTrigger><SelectContent className="max-h-60">{FONT_OPTIONS.map(f => (<SelectItem key={f.value} value={f.value} className="text-xs" style={{ fontFamily: f.value }}>{f.label}</SelectItem>))}</SelectContent></Select>
                    <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="h-8 w-14 lg:w-16 text-xs" min={10} max={72} />
                  </div>
                  <div className="flex items-center gap-3 lg:grid lg:grid-cols-2 lg:gap-2">
                    <div className="flex items-center gap-1 lg:gap-1.5"><label className="text-[10px] text-muted-foreground whitespace-nowrap">Cor</label><input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                    <div className="flex items-center gap-1 lg:gap-1.5"><label className="text-[10px] text-muted-foreground whitespace-nowrap">Contorno</label><input type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} className="h-7 w-7 rounded border border-border cursor-pointer" /></div>
                    <div className="flex items-center gap-1 lg:gap-1.5"><label className="text-[10px] text-muted-foreground whitespace-nowrap">Esp.</label><Input type="number" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="h-7 w-12 lg:w-16 text-xs" min={0} max={10} /></div>
                  </div>
                  {/* Curve slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-muted-foreground flex items-center gap-1"><WrapText className="h-3 w-3" /> Curva do texto</label>
                      <span className="text-[10px] font-medium text-muted-foreground">{textCurve === 0 ? 'Reto' : textCurve > 0 ? `Arco ↑ ${textCurve}` : `Arco ↓ ${Math.abs(textCurve)}`}</span>
                    </div>
                    <Slider value={[textCurve]} onValueChange={([v]) => setTextCurve(v)} min={-100} max={100} step={5} className="w-full" />
                    {textCurve !== 0 && (
                      <button onClick={() => setTextCurve(0)} className="text-[9px] text-primary hover:underline">Resetar para reto</button>
                    )}
                  </div>
                  <Button size="sm" onClick={handleAddTextClick} disabled={!textInput.trim()} className="w-full gap-1.5 h-8"><Type className="h-3.5 w-3.5" /> Adicionar</Button>
                </div>
              )}
              {activeTab === 'logo' && (
                <div className="space-y-2 lg:space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase hidden lg:block">Enviar logo ou imagem</p>
                  <label className="flex items-center lg:flex-col gap-3 lg:gap-2 px-4 py-4 lg:py-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                    <Upload className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground" />
                    <div className="lg:text-center"><span className="text-sm text-muted-foreground">Enviar logo ou imagem</span><span className="text-[10px] text-muted-foreground/60 block">PNG, JPG, SVG ou WebP</span></div>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-muted-foreground text-center hidden lg:block">A imagem será aplicada no lado <strong>{activeView === 'front' ? 'Frente' : 'Costas'}</strong></p>
                </div>
              )}
              <div className="mt-2 lg:mt-4 pt-2 lg:pt-3 border-t border-border/30">
                <Button variant="outline" size="sm" onClick={deleteSelected} className="w-full gap-1.5 text-destructive h-8 text-xs"><Trash2 className="h-3.5 w-3.5" /> Remover selecionado</Button>
              </div>
            </aside>
          )}

          {/* Canvas area */}
          <div className="order-1 lg:order-2 flex-1 flex flex-col overflow-hidden bg-muted/30">
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
            <div ref={mobileCanvasContainerRef} className="flex-1 overflow-auto p-2 lg:p-4 flex items-center justify-center">
              <div className="relative flex-shrink-0 lg:flex lg:gap-5 lg:items-center lg:justify-center"
                style={{ transform: `scale(${mobileScale})`, transformOrigin: 'center center' }}>
                <div ref={frontWrapRef}
                  className={`${activeView === 'front' ? 'block' : 'hidden lg:block'} ${activeView !== 'front' ? 'lg:opacity-50 lg:hover:opacity-75' : 'lg:ring-2 lg:ring-primary lg:ring-offset-2 lg:rounded-xl'} lg:cursor-pointer lg:transition-all lg:flex-shrink-0`}
                  onClick={() => setActiveView('front')}>
                  <p className="text-center text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wider hidden lg:block">Frente</p>
                  <div className="rounded-xl border border-border/50 shadow-lg overflow-hidden bg-background"><canvas ref={frontCanvasRef} /></div>
                </div>
                <div ref={backWrapRef}
                  className={`${activeView === 'back' ? 'block' : 'hidden lg:block'} ${activeView !== 'back' ? 'lg:opacity-50 lg:hover:opacity-75' : 'lg:ring-2 lg:ring-primary lg:ring-offset-2 lg:rounded-xl'} lg:cursor-pointer lg:transition-all lg:flex-shrink-0`}
                  onClick={() => setActiveView('back')}>
                  <p className="text-center text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wider hidden lg:block">Costas</p>
                  <div className="rounded-xl border border-border/50 shadow-lg overflow-hidden bg-background"><canvas ref={backCanvasRef} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile bottom tab bar */}
        <div className="lg:hidden border-t border-border bg-card flex items-stretch">
          {toolbarTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(activeTab === tab.id ? null : tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${activeTab === tab.id ? 'text-primary bg-primary/5' : 'text-muted-foreground'}`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>



      {/* Patch side + zone picker modal */}
      {pendingPatch && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center gap-2 mb-4">
              <Fish className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{!patchSideChoice ? 'Onde aplicar o peixe?' : 'Escolha a zona'}</h3>
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
              {templateZones.filter(z => z.side === activeView || z.shared).map(zone => (
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
    </div>
  );
};

export default ShirtEditor;
