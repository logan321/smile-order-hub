import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Canvas, FabricText, Textbox, FabricImage, Point, Polygon, FabricObject, Control, controlsUtils } from 'fabric';
import debounce from 'lodash/debounce';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Upload, Trash2, Download, Image as ImageIcon, ChevronLeft, Move, MapPin, ZoomIn, ZoomOut, RotateCcw, Shirt, Sparkles, X, Hand, Box } from 'lucide-react';
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
import { useUvColorMappings } from '@/hooks/useUvColorMappings';
import { scanSvgElements, applyColorMapToUv } from '@/lib/uvCompositor';
import type { UvLayer } from '@/lib/uvCompositor';

import type { UvZone } from '@/hooks/useUvLibrary';

// Thumbnail: show only the 2D front image uploaded for the stamp.
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

interface ShirtEditorProps {
  useOwnAssets?: boolean;
}

const ShirtEditor = ({ useOwnAssets }: ShirtEditorProps) => {
  const { userId: urlUserId, templateId: urlTemplateId } = useParams<{ userId: string; templateId?: string }>();
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontFabricRef = useRef<Canvas | null>(null);
  const backFabricRef = useRef<Canvas | null>(null);
  const [activeView, setActiveView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState<ToolbarTab>(null);
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [appliedStamp, setAppliedStamp] = useState<Stamp | null>(null);
  const [shirtColors, setShirtColors] = useState<Record<string, string>>({});
  const [editsVersion, setEditsVersion] = useState(0);

  const { data: templateColorMappings } = useUvColorMappings(selectedTemplate?.id);

  const debouncedBump = useMemo(
    () => debounce(() => setEditsVersion(v => v + 1), 80),
    []
  );

  useEffect(() => {
    if (templateColorMappings && templateColorMappings.length > 0) {
      const initialColors: Record<string, string> = {};
      templateColorMappings.forEach(m => {
        initialColors[m.original_color] = m.original_color;
      });
      setShirtColors(initialColors);
    }
  }, [templateColorMappings]);

  const shirtRegions = useMemo(() => {
    if (templateColorMappings && templateColorMappings.length > 0) {
      return templateColorMappings.map(m => ({
        id: m.original_color,
        label: m.region_name
      }));
    }
    return [];
  }, [templateColorMappings]);

  return (
    <div className="flex flex-col h-screen bg-background">
       {/* Simplified Editor UI */}
       <div className="p-4 border-b">
         <h1 className="text-xl font-bold">Editor de Camisas</h1>
       </div>
       <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r overflow-y-auto p-4">
             {shirtRegions.length > 0 && (
                <div className="space-y-4">
                   <h2 className="font-bold uppercase text-xs text-muted-foreground flex items-center gap-2">
                      <Shirt className="h-4 w-4" /> Cores do Molde UV
                   </h2>
                   {shirtRegions.map(region => (
                      <div key={region.id} className="flex items-center justify-between p-2 rounded bg-muted/50 border">
                         <span className="text-xs font-medium truncate">{region.label}</span>
                         <input 
                            type="color" 
                            value={shirtColors[region.id] || region.id} 
                            onChange={(e) => {
                               setShirtColors(prev => ({ ...prev, [region.id]: e.target.value }));
                               debouncedBump();
                            }}
                            className="h-6 w-10 cursor-pointer"
                         />
                      </div>
                   ))}
                </div>
             )}
          </div>
          <div className="flex-1 bg-muted/20 relative">
             <div className="absolute inset-0 flex items-center justify-center">
                {selectedTemplate && (
                   <Shirt3DPreview
                      frontImage={selectedTemplate.frontImageUrl}
                      backImage={selectedTemplate.backImageUrl}
                      fabricColor="#ffffff"
                      // other props...
                   />
                )}
             </div>
          </div>
       </div>
    </div>
  );
};

export default ShirtEditor;