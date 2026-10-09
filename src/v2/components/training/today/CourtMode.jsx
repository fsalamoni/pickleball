/**
 * MODO QUADRA: o treino de hoje em tela cheia, um item por vez, com letra
 * grande para ler de longe, as dicas curtas e o cronômetro do bloco. A tela
 * fica acesa enquanto ele está aberto (`useWakeLock`).
 *
 * Ao terminar, devolve o tempo total cronometrado para o registro do diário.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useWakeLock } from '@/core/lib/useWakeLock';
import { formatClock } from '@/modules/training/domain/treinar';
import { V2Button } from '@/v2/ui/primitives';
import CourtDiagram from '@/v2/components/training/CourtDiagram';

/**
 * @param {{ blocks: ReturnType<import('@/modules/training/domain/treinar').courtBlocks>,
 *   onClose: () => void, onFinish: (totalSec: number) => void }} props
 */
export default function CourtMode({ blocks, onClose, onFinish }) {
  const [i, setI] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [blocoSeg, setBlocoSeg] = useState(0);
  const totalRef = useRef(0);
  const { ativo: telaAcesa } = useWakeLock(true);
  const fecharRef = useRef(null);

  useEffect(() => {
    if (!rodando) return undefined;
    const t = setInterval(() => {
      totalRef.current += 1;
      setBlocoSeg((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [rodando]);

  // Esc fecha; o foco começa no botão de fechar (diálogo de tela cheia).
  useEffect(() => {
    fecharRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const b = blocks[i];
  const alvo = (b?.minutes || 0) * 60;
  const passou = alvo > 0 && blocoSeg >= alvo;
  const ir = (n) => { setI(n); setBlocoSeg(0); };
  const ultimo = i === blocks.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo quadra"
      data-dica="treino-modo-quadra"
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper-pure"
    >
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-bold text-gray-500">
          {i + 1} de {blocks.length}{telaAcesa ? ' · tela acesa' : ''}
        </p>
        <button
          ref={fecharRef}
          type="button"
          aria-label="Sair do modo quadra"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <h2 className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">{b?.title}</h2>
        {b?.objective && <p className="text-lg text-gray-600">{b.objective}</p>}

        <div className={cn('rounded-4xl p-6 text-center', passou ? 'bg-acid/30' : 'bg-gray-50')} aria-live="off">
          <p className="font-display text-6xl font-bold tabular-nums text-ink sm:text-7xl">{formatClock(blocoSeg)}</p>
          {alvo > 0 && (
            <p className="mt-1 text-base font-semibold text-gray-600">
              {passou ? 'Tempo do bloco cumprido' : `de ${b.minutes} min`}
            </p>
          )}
          <div className="mt-4 flex justify-center gap-3">
            <V2Button size="lg" onClick={() => setRodando((r) => !r)}>
              {rodando ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
              {rodando ? 'Pausar' : blocoSeg ? 'Continuar' : 'Começar'}
            </V2Button>
            <V2Button size="lg" variant="secondary" onClick={() => setBlocoSeg(0)} aria-label="Zerar o cronômetro do bloco">
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </V2Button>
          </div>
        </div>

        {b?.cues?.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Dicas">
            {b.cues.map((c) => (
              <li key={c} className="rounded-full bg-acid/20 px-4 py-2 text-lg font-bold text-ink">{c}</li>
            ))}
          </ul>
        )}

        {b?.setup && <p className="text-lg text-gray-700"><span className="font-bold">Montagem: </span>{b.setup}</p>}

        {b?.steps?.length > 0 && (
          <ol className="space-y-3">
            {b.steps.map((s, n) => (
              <li key={`${n}-${s}`} className="flex gap-3 text-lg leading-relaxed text-ink">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper-pure">{n + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}

        {b?.diagram && <CourtDiagram diagram={b.diagram} className="mx-auto max-w-sm" />}
        {b?.success && <p className="rounded-3xl bg-gray-50 p-4 text-lg text-ink"><span className="font-bold">Meta: </span>{b.success}</p>}
      </main>

      <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-gray-100 bg-paper-pure px-4 py-3">
        <V2Button variant="secondary" size="lg" disabled={i === 0} onClick={() => ir(i - 1)}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Anterior
        </V2Button>
        {ultimo ? (
          <V2Button size="lg" onClick={() => { setRodando(false); onFinish(totalRef.current); }}>Terminei</V2Button>
        ) : (
          <V2Button size="lg" onClick={() => ir(i + 1)}>
            Próximo <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </V2Button>
        )}
      </footer>
    </div>
  );
}
