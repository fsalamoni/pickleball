/**
 * O PAINEL das dicas — o que abre no botão "Dicas" do topo.
 *
 * Três coisas, na ordem em que a pessoa pensa:
 *  1. o INTERRUPTOR — dicas na tela ligadas ou desligadas;
 *  2. NESTA TELA — os guias do lugar onde ela está (o da ferramenta primeiro);
 *  3. "O QUE VOCÊ QUER FAZER?" — a busca e todos os guias, por área.
 *
 * Os guias funcionam com as dicas ligadas ou não: pedir um guia já é querer
 * a dica. O interruptor decide o que aparece SOZINHO na tela (os pontos).
 */
import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Building2, CalendarCheck, Check, ChevronRight, Compass, GraduationCap, LifeBuoy, Lightbulb, PlayCircle, RotateCcw,
  Settings, Sparkles, Swords, Trophy, Users,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { V2SearchInput } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { helpLinkFor } from '@/modules/help/domain/helpLink';
import {
  buscarGuias, guiasDaTela, guiasPorArea,
} from '@/modules/help/domain/guias';
import { pontosDaTela } from '@/modules/help/domain/pontosDeDica';
import { useDicas } from './DicasContext';
import InterruptorDicas from './InterruptorDicas';

const ICONES = {
  Building2, CalendarCheck, Compass, GraduationCap, Settings, Sparkles, Swords, Trophy, Users,
};

function LinhaGuia({ guia, feito, onIniciar }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onIniciar(guia.id)}
        className="group flex w-full items-center gap-3 rounded-2xl border border-transparent p-3 text-left transition-colors hover:border-gray-200 hover:bg-paper focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
      >
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', feito ? 'bg-acid/25 text-ink' : 'bg-paper text-ink')} aria-hidden="true">
          {feito ? <Check className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{guia.title}</span>
          <span className="block text-xs leading-snug text-gray-500">
            {guia.summary}
            <span className="whitespace-nowrap text-gray-400"> · {guia.steps.length} {guia.steps.length === 1 ? 'passo' : 'passos'}{feito ? ' · feito' : ''}</span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
      </button>
    </li>
  );
}

function Rotulo({ children, dica }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{children}</h3>
      {dica && <p className="text-xs text-gray-400">{dica}</p>}
    </div>
  );
}

export default function PainelDeDicas({ ctx }) {
  const d = useDicas();
  const location = useLocation();
  const [busca, setBusca] = useState('');
  const feitos = useMemo(() => new Set(d.feitos), [d.feitos]);

  const formatoDoDia = typeof document !== 'undefined'
    ? document.querySelector('[data-formato-dia]')?.getAttribute('data-formato-dia') || null
    : null;
  const ctxTela = useMemo(() => ({ ...ctx, formatoDoDia }), [ctx, formatoDoDia]);
  const daTela = useMemo(() => guiasDaTela(location.pathname, ctxTela), [location.pathname, ctxTela]);
  const pontosAqui = useMemo(() => pontosDaTela(location.pathname, ctx).length, [location.pathname, ctx]);
  const resultado = useMemo(() => (busca.trim() ? buscarGuias(busca, ctx) : null), [busca, ctx]);
  const areas = useMemo(() => guiasPorArea(ctx), [ctx]);
  const ajudaOn = Boolean(ctx.flags?.help_center);

  const iniciar = (id) => { setBusca(''); d.iniciarGuia(id); };

  return (
    <Dialog open={d.painelAberto} onOpenChange={(v) => { if (!v) d.fecharPainel(); }}>
      <DialogContent
        className={cn(
          'left-auto right-0 top-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-md translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-paper-pure p-0',
          'sm:rounded-l-4xl sm:border-l sm:border-gray-100',
        )}
      >
        <DialogHeader className="border-b border-gray-100 px-5 pb-4 pt-5 text-left sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acid text-ink" aria-hidden="true">
              <Lightbulb className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-display text-xl font-bold text-ink">Dicas</DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                Guias na tela de verdade, e pontos que explicam cada botão.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
          <div className={cn('flex items-start gap-3 rounded-3xl border p-4', d.ligadas ? 'border-acid/60 bg-acid/10' : 'border-gray-100 bg-paper')}>
            <div className="min-w-0 flex-1">
              <label htmlFor="dicas-interruptor" className="block font-display text-base font-bold text-ink">
                Dicas na tela {d.ligadas ? 'ligadas' : 'desligadas'}
              </label>
              <p className="mt-0.5 text-xs leading-5 text-gray-600">
                {d.ligadas
                  ? 'Pontos pulsando ao lado dos botões dizem aonde cada um leva. Toque num ponto para ver a dica.'
                  : 'Nada aparece sozinho. Ligue para ver, em cada tela, pontos que explicam os botões.'}
              </p>
              {d.ligadas && pontosAqui > 0 && (
                <p className="mt-1 text-xs font-semibold text-ink">
                  {pontosAqui === 1 ? 'Esta tela tem 1 ponto de dica.' : `Esta tela tem até ${pontosAqui} pontos de dica.`}
                </p>
              )}
            </div>
            <InterruptorDicas id="dicas-interruptor" ligadas={d.ligadas} onAlternar={d.alternar} />
          </div>

          {daTela.length > 0 && !resultado && (
            <section aria-label="Guias desta tela" className="space-y-2">
              <Rotulo>Nesta tela</Rotulo>
              <ul className="space-y-1">
                {daTela.map((g) => <LinhaGuia key={g.id} guia={g} feito={feitos.has(g.id)} onIniciar={iniciar} />)}
              </ul>
            </section>
          )}

          <section aria-label="O que você quer fazer?" className="space-y-3">
            <Rotulo>O que você quer fazer?</Rotulo>
            <V2SearchInput
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: reservar quadra, criar torneio"
              aria-label="Buscar um guia"
            />
            {resultado ? (
              resultado.length > 0 ? (
                <ul className="space-y-1">
                  {resultado.map((g) => <LinhaGuia key={g.id} guia={g} feito={feitos.has(g.id)} onIniciar={iniciar} />)}
                </ul>
              ) : (
                <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-gray-600">
                  Nenhum guia com essas palavras. Tente com menos palavras
                  {ajudaOn ? ' — ou procure na Central de ajuda.' : '.'}
                </p>
              )
            ) : (
              <div className="space-y-5">
                {areas.map((a) => {
                  const Icone = ICONES[a.icon] || Compass;
                  return (
                    <div key={a.area} className="space-y-1">
                      <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-gray-500">
                        <Icone className="h-3.5 w-3.5" aria-hidden="true" /> {a.label}
                      </p>
                      <ul className="space-y-1">
                        {a.guias.map((g) => <LinhaGuia key={g.id} guia={g} feito={feitos.has(g.id)} onIniciar={iniciar} />)}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 sm:px-6">
          {ajudaOn ? (
            <Link
              to={helpLinkFor(location.pathname)}
              onClick={d.fecharPainel}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink"
            >
              <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Central de ajuda
            </Link>
          ) : <span />}
          {d.vistos.length > 0 && (
            <button
              type="button"
              onClick={d.recomecarVistos}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Mostrar de novo os pontos já vistos
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
