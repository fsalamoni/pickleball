/**
 * Um ponto de dica ABERTO: o mesmo destaque dos guias (foco, seta, cartão)
 * sobre o botão, dizendo aonde ele leva — e, quando há, o guia da tarefa.
 *
 * "Entendi" marca o ponto como visto (ele para de pulsar). Esc e o X fecham
 * sem marcar: quem fechou sem ler pode querer ver de novo.
 */
import React, { useEffect, useId, useRef } from 'react';
import { Lightbulb, PlayCircle, X } from 'lucide-react';
import { V2Button } from '@/v2/ui/primitives';
import Destaque from './Destaque';
import { useAlvoNaTela } from './alvoNaTela';

export default function PontoAberto({ ponto, guia, onFechar, onEntendi, onGuia }) {
  const tituloId = useId();
  const tituloRef = useRef(null);
  const { el, rect } = useAlvoNaTela([ponto.target], { chave: ponto.id });

  useEffect(() => {
    const q = requestAnimationFrame(() => tituloRef.current?.focus({ preventScroll: true }));
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => { cancelAnimationFrame(q); window.removeEventListener('keydown', aoTeclar); };
  }, [onFechar]);

  return (
    <Destaque el={el} rect={rect} tituloId={tituloId} chave={ponto.id}>
      <div className="flex items-start justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
          <Lightbulb className="h-3.5 w-3.5 text-acid-dark" aria-hidden="true" /> Dica
        </p>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar a dica"
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <h2 id={tituloId} ref={tituloRef} tabIndex={-1} className="mt-1 font-display text-lg font-bold leading-tight text-ink outline-none">
        {ponto.title}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-gray-600">{ponto.body}</p>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {guia && (
          <V2Button variant="secondary" size="sm" onClick={onGuia}>
            <PlayCircle className="h-4 w-4" aria-hidden="true" /> Me mostre como
          </V2Button>
        )}
        <V2Button size="sm" onClick={onEntendi}>Entendi</V2Button>
      </div>
    </Destaque>
  );
}
