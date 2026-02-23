import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Hand } from 'lucide-react';

export type GuideStep =
  | 'niche'
  | 'template'
  | 'stamps-tab'
  | 'stamp-pick'
  | 'stamp-color'
  | 'text-tab'
  | 'text-pick'
  | 'logo-tab'
  | 'done';

const GUIDE_MESSAGES: Record<GuideStep, string> = {
  niche: '👆 Selecione aqui o segmento que deseja personalizar',
  template: '👆 Escolha o modelo de camisa que você quer editar',
  'stamps-tab': '👆 Clique aqui para escolher uma estampa',
  'stamp-pick': '👆 Agora escolha a estampa que deseja aplicar',
  'stamp-color': '👆 Escolha a cor da estampa que preferir',
  'text-tab': '👆 Clique aqui para adicionar texto na camisa',
  'text-pick': '✏️ Digite seu texto e clique em Adicionar',
  'logo-tab': '👆 Clique aqui para enviar sua logo ou imagem',
  done: '',
};

const GUIDE_TARGETS: Record<GuideStep, string> = {
  niche: '[data-guide="niche"]',
  template: '[data-guide="template"]',
  'stamps-tab': '[data-guide="stamps-tab"]',
  'stamp-pick': '[data-guide="stamp-pick"]',
  'stamp-color': '[data-guide="stamp-color"]',
  'text-tab': '[data-guide="text-tab"]',
  'text-pick': '[data-guide="text-pick"]',
  'logo-tab': '[data-guide="logo-tab"]',
  done: '',
};

// Steps where the target is at the bottom of the screen (tab bar)
const BOTTOM_TARGETS = new Set<GuideStep>(['stamps-tab', 'text-tab', 'logo-tab']);

interface EditorGuideProps {
  step: GuideStep;
  onSkip: () => void;
  onDismissAll: () => void;
}

const EditorGuide = ({ step, onSkip, onDismissAll }: EditorGuideProps) => {
  const [pos, setPos] = useState<{ x: number; y: number; found: boolean }>({ x: 0, y: 0, found: false });
  const rafRef = useRef<number>(0);

  const updatePosition = useCallback(() => {
    if (step === 'done') return;
    const selector = GUIDE_TARGETS[step];
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        found: true,
      });
    } else {
      setPos(p => ({ ...p, found: false }));
    }
    rafRef.current = requestAnimationFrame(updatePosition);
  }, [step]);

  useEffect(() => {
    if (step === 'done') return;
    rafRef.current = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, updatePosition]);

  if (step === 'done' || !pos.found) return null;

  const message = GUIDE_MESSAGES[step];
  const isBottomTarget = BOTTOM_TARGETS.has(step);

  // Dialog is positioned in a safe area: 
  // - If target is at bottom (tab bar), dialog goes to top-center
  // - Otherwise, dialog goes to bottom-center
  const dialogStyle: React.CSSProperties = isBottomTarget
    ? { top: 16, left: '50%', transform: 'translateX(-50%)' }
    : { bottom: 80, left: '50%', transform: 'translateX(-50%)' };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-live="polite">
      {/* Small animated hand pointer — precisely on target, small so it doesn't block clicks */}
      <div
        className="absolute pointer-events-none transition-all duration-300 ease-out"
        style={{
          left: pos.x - 10,
          top: pos.y - 10,
          zIndex: 101,
        }}
      >
        <div className="animate-guide-hand">
          <Hand className="h-5 w-5 text-accent drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] -rotate-12" fill="hsl(var(--accent))" />
        </div>
      </div>

      {/* Dialog box — fixed in safe zone, away from clickable elements */}
      <div
        className="absolute pointer-events-auto"
        style={{ ...dialogStyle, zIndex: 102, maxWidth: 'calc(100vw - 24px)', width: 280 }}
      >
        <div className="bg-card border-2 border-accent rounded-2xl shadow-2xl px-4 py-3 relative">
          <button
            onClick={onSkip}
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            title="Pular esta etapa"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="text-sm font-semibold text-foreground leading-snug pr-5">
            {message}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
            Caso não vá editar essa parte, aperte no <strong className="text-destructive">X</strong>
          </p>
          <div className="flex justify-end mt-1.5">
            <button
              onClick={onDismissAll}
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              Desativar guia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorGuide;
