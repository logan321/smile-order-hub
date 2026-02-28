import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

export type GuideStep =
  | 'niche'
  | 'template'
  | 'stamps-tab'
  | 'stamp-pick'
  | 'stamp-color'
  | 'patches-tab'
  | 'patch-pick'
  | 'text-tab'
  | 'text-pick'
  | 'logo-tab'
  | 'budget'
  | 'done';

const GUIDE_MESSAGES: Record<GuideStep, string> = {
  niche: '👆 Selecione aqui o segmento que deseja personalizar',
  template: '👆 Escolha o modelo de camisa que você quer editar',
  'stamps-tab': '👆 Clique aqui para escolher uma estampa',
  'stamp-pick': '👆 Agora escolha a estampa que deseja aplicar',
  'stamp-color': '👆 Escolha a cor da estampa que preferir',
  'patches-tab': '👆 Clique aqui para escolher um emblema',
  'patch-pick': '👆 Agora escolha o emblema que deseja aplicar',
  'text-tab': '👆 Clique aqui para adicionar texto na camisa',
  'text-pick': '✏️ Digite seu texto e clique em Adicionar',
  'logo-tab': '👆 Clique aqui para enviar sua logo ou imagem',
  budget: '👆 Quando terminar, clique aqui para enviar o orçamento!',
  done: '',
};

const GUIDE_KEY: Record<GuideStep, string> = {
  niche: 'niche',
  template: 'template',
  'stamps-tab': 'stamps-tab',
  'stamp-pick': 'stamp-pick',
  'stamp-color': 'stamp-color',
  'patches-tab': 'patches-tab',
  'patch-pick': 'patch-pick',
  'text-tab': 'text-tab',
  'text-pick': 'text-pick',
  'logo-tab': 'logo-tab',
  budget: 'budget',
  done: '',
};

const DIALOG_HEIGHT = 110;

/** Find the guide target element, preferring the visible one on the current device */
function findGuideElement(key: string, isMobile: boolean): Element | null {
  if (!key) return null;

  // 1. For tabs that have separate mobile/desktop elements, use the right one
  if (isMobile) {
    const mobileEl = document.querySelector(`[data-guide-mobile="${key}"]`);
    if (mobileEl) return mobileEl;
  } else {
    const desktopEl = document.querySelector(`[data-guide-desktop="${key}"]`);
    if (desktopEl) return desktopEl;
  }

  // 2. Fall back to generic data-guide (for shared elements like niche, template, budget)
  const allEls = document.querySelectorAll(`[data-guide="${key}"]`);
  
  // If multiple matches, find the one that's actually visible on screen
  for (const el of allEls) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0) {
      return el;
    }
  }

  // Last resort: return first match
  return allEls[0] || null;
}

interface EditorGuideProps {
  step: GuideStep;
  onSkip: () => void;
  onDismissAll: () => void;
}

const EditorGuide = ({ step, onSkip, onDismissAll }: EditorGuideProps) => {
  const [pos, setPos] = useState<{ x: number; y: number; top: number; bottom: number; found: boolean }>({
    x: 0, y: 0, top: 0, bottom: 0, found: false,
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const updatePosition = useCallback(() => {
    if (step === 'done') return;
    const key = GUIDE_KEY[step];
    if (!key) return;
    const el = findGuideElement(key, isMobile);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        top: rect.top,
        bottom: rect.bottom,
        found: true,
      });
    } else {
      setPos(p => ({ ...p, found: false }));
    }
    rafRef.current = requestAnimationFrame(updatePosition);
  }, [step, isMobile]);

  useEffect(() => {
    if (step === 'done') return;
    rafRef.current = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step, updatePosition]);

  if (step === 'done' || !pos.found) return null;

  const message = GUIDE_MESSAGES[step];
  const vh = window.innerHeight;

  const spaceAbove = pos.top;
  const spaceBelow = vh - pos.bottom;

  let dialogStyle: React.CSSProperties;

  if (spaceBelow >= DIALOG_HEIGHT + 20) {
    dialogStyle = { top: pos.bottom + 12, left: '50%', transform: 'translateX(-50%)' };
  } else if (spaceAbove >= DIALOG_HEIGHT + 20) {
    dialogStyle = { top: pos.top - DIALOG_HEIGHT - 12, left: '50%', transform: 'translateX(-50%)' };
  } else {
    if (spaceAbove > spaceBelow) {
      dialogStyle = { top: Math.max(8, spaceAbove / 2 - DIALOG_HEIGHT / 2), left: '50%', transform: 'translateX(-50%)' };
    } else {
      dialogStyle = { top: Math.min(vh - DIALOG_HEIGHT - 8, pos.bottom + spaceBelow / 2 - DIALOG_HEIGHT / 2), left: '50%', transform: 'translateX(-50%)' };
    }
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" aria-live="polite">
      {/* Small animated hand — precisely on target center */}
      <div
        className="absolute pointer-events-none transition-all duration-300 ease-out"
        style={{ left: pos.x - 10, top: pos.y - 10, zIndex: 101 }}
      >
        <div className="animate-guide-hand">
          <span className="text-2xl drop-shadow-[0_2px_6px_rgba(220,38,38,0.7)]" style={{ display: 'inline-block', transform: 'rotate(0deg)' }}>👆</span>
        </div>
      </div>

      {/* Dialog — positioned based on available space */}
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
