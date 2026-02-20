import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Pipette, Paintbrush, Plus, Trash2, X } from 'lucide-react';
import { ColorMask } from '@/lib/colorMasking';

interface ColorMaskPanelProps {
  colorMaskMode: boolean;
  onToggleMode: () => void;
  eyedropperActive: boolean;
  onToggleEyedropper: () => void;
  currentMaskSource: string;
  onSourceChange: (hex: string) => void;
  currentMaskTarget: string;
  onTargetChange: (hex: string) => void;
  currentMaskTolerance: number;
  onToleranceChange: (val: number) => void;
  colorMasks: ColorMask[];
  onAddMask: () => void;
  onRemoveMask: (index: number) => void;
  onClearAll: () => void;
  hasAppliedStamp: boolean;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

const ColorMaskPanel = ({
  colorMaskMode, onToggleMode, eyedropperActive, onToggleEyedropper,
  currentMaskSource, onSourceChange, currentMaskTarget, onTargetChange,
  currentMaskTolerance, onToleranceChange,
  colorMasks, onAddMask, onRemoveMask, onClearAll, hasAppliedStamp,
}: ColorMaskPanelProps) => {
  if (!hasAppliedStamp) return null;

  return (
    <div className="mt-3 pt-2 border-t border-border/30">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
          <Paintbrush className="h-3 w-3" />
          Trocar Cores
        </p>
        <Button
          variant={colorMaskMode ? 'default' : 'outline'}
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={onToggleMode}
        >
          {colorMaskMode ? 'Desativar' : 'Ativar'}
        </Button>
      </div>

      {colorMaskMode && (
        <div className="space-y-2">
          <p className="text-[9px] text-muted-foreground">
            Clique no conta-gotas, toque na cor da estampa que deseja trocar, escolha a nova cor e ajuste a tolerância.
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant={eyedropperActive ? 'default' : 'outline'}
              size="sm"
              className={`h-7 text-[10px] px-2 gap-1 ${eyedropperActive ? 'animate-pulse' : ''}`}
              onClick={onToggleEyedropper}
            >
              <Pipette className="h-3 w-3" />
              {eyedropperActive ? 'Clique na estampa...' : 'Capturar cor'}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <label className="text-[9px] text-muted-foreground whitespace-nowrap">De:</label>
              <input
                type="color"
                value={currentMaskSource}
                onChange={e => onSourceChange(e.target.value)}
                className="h-7 w-7 rounded border border-border cursor-pointer"
              />
            </div>
            <span className="text-muted-foreground text-xs">→</span>
            <div className="flex items-center gap-1">
              <label className="text-[9px] text-muted-foreground whitespace-nowrap">Para:</label>
              <input
                type="color"
                value={currentMaskTarget}
                onChange={e => onTargetChange(e.target.value)}
                className="h-7 w-7 rounded border border-border cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[9px] text-muted-foreground whitespace-nowrap">Tolerância:</label>
            <Slider
              value={[currentMaskTolerance]}
              onValueChange={([v]) => onToleranceChange(v)}
              min={5}
              max={60}
              step={1}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground w-6 text-right">{currentMaskTolerance}%</span>
          </div>

          <Button size="sm" className="w-full h-7 text-[10px] gap-1" onClick={onAddMask}>
            <Plus className="h-3 w-3" /> Aplicar troca de cor
          </Button>

          {/* Active masks list */}
          {colorMasks.length > 0 && (
            <div className="space-y-1 mt-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold text-muted-foreground">Trocas ativas ({colorMasks.length})</p>
                <button onClick={onClearAll} className="text-[9px] text-destructive hover:underline">Limpar tudo</button>
              </div>
              {colorMasks.map((mask, idx) => (
                <div key={idx} className="flex items-center gap-1.5 p-1.5 rounded bg-muted/30 border border-border/30">
                  <div
                    className="h-5 w-5 rounded-full border border-border flex-shrink-0"
                    style={{ backgroundColor: rgbToHex(mask.sourceColor[0], mask.sourceColor[1], mask.sourceColor[2]) }}
                  />
                  <span className="text-muted-foreground text-[10px]">→</span>
                  <div
                    className="h-5 w-5 rounded-full border border-border flex-shrink-0"
                    style={{ backgroundColor: rgbToHex(mask.targetColor[0], mask.targetColor[1], mask.targetColor[2]) }}
                  />
                  <span className="text-[9px] text-muted-foreground flex-1">{mask.tolerance}%</span>
                  <button onClick={() => onRemoveMask(idx)} className="p-0.5">
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ColorMaskPanel;
