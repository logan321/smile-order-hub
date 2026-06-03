import { useMemo, useState } from 'react';
import { useTemplateZones, TemplateZone } from '@/hooks/useTemplateZones';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, MapPin, Trash2 } from 'lucide-react';
import Shirt3DEditor, { Decal3D } from '@/components/Shirt3DEditor';

interface Zone3DEditorProps {
  templateId?: string;
  uvMapId?: string;
  onClose: () => void;
}

// A small white square texture used as the visual marker for a zone in admin mode.
// We don't render the real patch/text here — just a labeled rectangle showing
// where the decal will project so the admin can verify size/position.
const ZONE_MARKER_PNG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect x="2" y="2" width="96" height="96" fill="rgba(245,158,11,0.55)" stroke="#f59e0b" stroke-width="4"/>
      <circle cx="50" cy="50" r="6" fill="#fff"/>
    </svg>`,
  );

const DEFAULT_SIZE: [number, number, number] = [0.25, 0.25, 0.5];

const Zone3DEditor = ({ templateId, uvMapId, onClose }: Zone3DEditorProps) => {
  const { zones, updateZone, loading } = useTemplateZones(templateId, uvMapId);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [pendingPick, setPendingPick] = useState<{
    position: [number, number, number];
    normal: [number, number, number];
  } | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [draftSize, setDraftSize] = useState<number>(DEFAULT_SIZE[0]);
  const [draftRotation, setDraftRotation] = useState<number>(0);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  // Build the decals list: each zone with 3D data renders as a marker, plus the
  // pending pick (orange square) for the zone currently being edited.
  const decals: Decal3D[] = useMemo(() => {
    const list: Decal3D[] = [];
    for (const z of zones) {
      if (z.id === selectedZoneId && pendingPick) {
        list.push({
          id: `pending-${z.id}`,
          textureUrl: ZONE_MARKER_PNG,
          position: pendingPick.position,
          normal: pendingPick.normal,
          size: [draftSize, draftSize, DEFAULT_SIZE[2]],
          rotation: draftRotation,
          opacity: 0.9,
        });
        continue;
      }
      if (z.position3d && z.normal3d) {
        list.push({
          id: z.id,
          textureUrl: ZONE_MARKER_PNG,
          position: z.position3d,
          normal: z.normal3d,
          size: z.defaultSize3d ?? DEFAULT_SIZE,
          rotation: z.rotation3d ?? 0,
          opacity: z.id === selectedZoneId ? 0.95 : 0.5,
        });
      }
    }
    return list;
  }, [zones, selectedZoneId, pendingPick, draftSize, draftRotation]);

  const handlePick = (hit: { position: [number, number, number]; normal: [number, number, number] }) => {
    if (!selectedZoneId) {
      toast.error('Selecione uma zona na lista primeiro');
      return;
    }
    setPendingPick(hit);
  };

  const handleSave = async () => {
    if (!selectedZone || !pendingPick) return;
    await updateZone(selectedZone.id, {
      position3d: pendingPick.position,
      normal3d: pendingPick.normal,
      defaultSize3d: [draftSize, draftSize, DEFAULT_SIZE[2]],
      rotation3d: draftRotation,
    });
    setPendingPick(null);
    setPickMode(false);
    toast.success(`Zona "${selectedZone.name}" salva no 3D`);
  };

  const handleClear = async (z: TemplateZone) => {
    await updateZone(z.id, {
      position3d: null,
      normal3d: null,
      defaultSize3d: null,
      rotation3d: null,
    });
    if (selectedZoneId === z.id) setPendingPick(null);
    toast.success('Posição 3D removida');
  };

  const startEditing = (z: TemplateZone) => {
    setSelectedZoneId(z.id);
    setPendingPick(null);
    setPickMode(true);
    setDraftSize(z.defaultSize3d?.[0] ?? DEFAULT_SIZE[0]);
    setDraftRotation(z.rotation3d ?? 0);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Definir zonas no 3D</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 flex-1 min-h-0">
          {/* Zone list */}
          <div className="border rounded-lg p-2 overflow-y-auto max-h-[70vh]">
            <p className="text-xs text-muted-foreground mb-2 px-1">
              {loading ? 'Carregando…' : zones.length === 0 ? 'Nenhuma zona cadastrada. Crie zonas no editor 2D primeiro.' : 'Selecione uma zona e clique no ponto da camisa 3D onde ela deve ficar.'}
            </p>
            <ul className="space-y-1">
              {zones.map((z) => {
                const has3d = !!(z.position3d && z.normal3d);
                const isSel = z.id === selectedZoneId;
                return (
                  <li
                    key={z.id}
                    className={`p-2 rounded border text-sm cursor-pointer ${isSel ? 'border-amber-500 bg-amber-50' : 'border-border hover:bg-muted/40'}`}
                    onClick={() => startEditing(z)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{z.name}</span>
                      {has3d ? (
                        <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> 3D</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" /> 2D</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{z.side}{z.shared ? ' • compart.' : ''}</div>
                    {has3d && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-6 px-1 text-[11px] text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleClear(z); }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Remover 3D
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 3D viewer */}
          <div className="flex flex-col gap-2 min-h-0">
            <div className="flex-1 min-h-[400px] relative">
              <Shirt3DEditor
                decals={decals}
                pickEnabled={pickMode && !!selectedZoneId}
                onPick={handlePick}
              />
            </div>

            {selectedZone && (
              <div className="border rounded-lg p-3 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Zona: {selectedZone.name}</div>
                  {!pickMode && (
                    <Button size="sm" variant="outline" onClick={() => setPickMode(true)}>
                      Reposicionar
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Tamanho padrão</span>
                    <span className="font-mono">{draftSize.toFixed(2)}</span>
                  </label>
                  <Slider
                    min={0.05}
                    max={1.0}
                    step={0.01}
                    value={[draftSize]}
                    onValueChange={(v) => setDraftSize(v[0])}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Rotação (graus)</span>
                    <span className="font-mono">{Math.round((draftRotation * 180) / Math.PI)}°</span>
                  </label>
                  <Slider
                    min={-Math.PI}
                    max={Math.PI}
                    step={0.05}
                    value={[draftRotation]}
                    onValueChange={(v) => setDraftRotation(v[0])}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => { setPendingPick(null); setPickMode(false); }}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={!pendingPick && !(selectedZone.position3d && selectedZone.normal3d)}>
                    Salvar zona 3D
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Zone3DEditor;