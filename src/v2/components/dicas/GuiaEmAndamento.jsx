/**
 * O GUIA EM ANDAMENTO — conduz a pessoa passo a passo pela tela de verdade.
 *
 * Para cada passo:
 *  1. está na tela certa? Não: leva até ela (uma vez), ou diz onde é;
 *  2. acha o botão (`data-dica`), rola até ele e desenha o destaque com a seta;
 *  3. espera: o "Próximo", ou a própria ação — tocar no botão, a tela mudar, o
 *     formulário abrir. Aí o guia acompanha sozinho;
 *  4. não achou o botão (permissão, funcionalidade desligada, ainda não
 *     carregou)? Diz isso com franqueza e deixa pular — nunca uma seta para
 *     o nada.
 *
 * O guia sobrevive à troca de tela e a recarregar a página (a posição fica na
 * sessão). Esc sai — a não ser que um diálogo esteja aberto: aí o Esc é dele.
 */
import React, { useCallback, useEffect, useId, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Check, Lightbulb, MapPin, MousePointerClick, X,
} from 'lucide-react';
import { V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { casaRota } from '@/modules/help/domain/dicasRota';
import {
  alvosDoPasso, destinoDeRecuo, destinoDoPasso, paragrafos, passoQueAbre,
} from '@/modules/help/domain/guias';
import { useDicas } from './DicasContext';
import Destaque from './Destaque';
import { dialogoDe, encontrarAlvo, haDialogoAberto, useAlvoNaTela } from './alvoNaTela';
import { conteinerQueRola, rolarAte } from '@/v2/ui/rolarAte';

const reduzMovimento = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** O alvo cabe inteiro na tela (abaixo do topo fixo)? */
function inteiroNaTela(rect) {
  if (!rect) return true;
  return rect.top >= 88 && rect.top + rect.height <= window.innerHeight - 16;
}

/**
 * Dentro de um diálogo, o alvo está escondido — acima da área que rola, ou
 * debaixo da faixa do guia (`reserva` px no pé do diálogo)?
 */
function encobertoNoDialogo(el, reserva) {
  const conteiner = conteinerQueRola(el);
  if (!conteiner) return false;
  const c = conteiner.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return r.top < c.top + 8 || r.bottom > c.bottom - reserva;
}

/** O primeiro elemento focável do alvo (ele mesmo, se for). */
function focavel(el) {
  if (!el) return null;
  if (el.matches?.('a,button,input,select,textarea,[tabindex]')) return el;
  return el.querySelector?.('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])') || null;
}

/** As bolinhas de progresso. */
function Progresso({ total, atual }) {
  return (
    <div className="mt-4 flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn('h-1.5 rounded-full transition-all', i === atual ? 'w-5 bg-ink' : i < atual ? 'w-1.5 bg-acid' : 'w-1.5 bg-gray-200')}
        />
      ))}
    </div>
  );
}

export default function GuiaEmAndamento({ guia, passoIdx, ctx }) {
  const { irParaPasso, encerrarGuia } = useDicas();
  const location = useLocation();
  const navigate = useNavigate();
  const tituloId = useId();
  const tituloRef = useRef(null);

  const total = guia.steps.length;
  const idx = Math.min(Math.max(0, passoIdx || 0), total - 1);
  const passo = guia.steps[idx];
  const ultimo = idx === total - 1;
  const chave = `${guia.id}:${passo.id}`;
  const caminho = location.pathname;
  const naTela = !passo.route || casaRota(passo.route, caminho);
  const destino = destinoDoPasso(passo, ctx);
  const alvos = alvosDoPasso(passo);
  const espera = passo.advanceOn || null;

  const avancar = useCallback(() => {
    if (ultimo) encerrarGuia({ concluido: true });
    else irParaPasso(idx + 1);
  }, [ultimo, idx, irParaPasso, encerrarGuia]);

  // 1. Levar à tela do passo — uma vez por passo (depois, só se a pessoa pedir).
  const levouPara = useRef('');
  useEffect(() => {
    if (naTela || !destino || levouPara.current === chave) return;
    if (espera?.route && casaRota(espera.route, caminho)) return;
    levouPara.current = chave;
    navigate(destino);
  }, [naTela, destino, chave, espera, caminho, navigate]);

  // 2. Achar o botão e trazê-lo para a vista.
  const { el, rect, procurando } = useAlvoNaTela(alvos, { ativo: naTela && alvos.length > 0, chave });
  const rolouPara = useRef('');
  useEffect(() => {
    if (!el || rolouPara.current === chave) return;
    rolouPara.current = chave;
    const dialogo = dialogoDe(el);
    if (dialogo?.hasAttribute('data-state')) {
      // Num diálogo, o cartão é uma faixa presa ao rodapé dele: o campo tem de
      // ficar ACIMA dela, não só dentro da janela. Mede no quadro seguinte,
      // com a faixa do passo novo já desenhada (sem cancelar: a medida do
      // alvo muda a cada quadro e refaria este efeito).
      requestAnimationFrame(() => {
        const faixa = dialogo.querySelector('[data-dica-faixa]');
        const reserva = faixa ? faixa.getBoundingClientRect().height + 16 : 0;
        if (encobertoNoDialogo(el, reserva)) {
          rolarAte(el, { suave: !reduzMovimento(), alinhar: 'centro', reservaInferior: reserva });
        }
      });
      return;
    }
    if (!inteiroNaTela(rect)) rolarAte(el, { suave: !reduzMovimento(), alinhar: 'centro' });
  }, [el, rect, chave]);

  // 3. Esperar a ação de verdade.
  useEffect(() => {
    if (!naTela || espera !== 'click') return undefined;
    const aoClicar = (e) => {
      const t = e.target;
      if (alvos.some((a) => t?.closest?.(`[data-dica="${a}"]`))) setTimeout(avancar, 80);
    };
    document.addEventListener('click', aoClicar, true);
    return () => document.removeEventListener('click', aoClicar, true);
  }, [naTela, espera, alvos.join('|'), avancar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (espera?.route && casaRota(espera.route, caminho)) avancar();
  }, [espera, caminho, avancar]);

  useEffect(() => {
    if (!espera?.appears) return undefined;
    const t = setInterval(() => { if (encontrarAlvo([espera.appears])) avancar(); }, 200);
    return () => clearInterval(t);
  }, [espera, avancar]);

  // Esc sai do guia (o Esc de um diálogo aberto é do diálogo).
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || haDialogoAberto()) return;
      encerrarGuia();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [encerrarGuia]);

  // O foco vai para o título do passo — menos quando a pessoa está digitando
  // num campo (o formulário que o guia acabou de abrir, por exemplo).
  useEffect(() => {
    const ativo = document.activeElement;
    const digitando = ativo && ativo.matches?.('input,textarea,select,[contenteditable="true"]');
    if (digitando) return undefined;
    const q = requestAnimationFrame(() => tituloRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(q);
  }, [chave, naTela]);

  const naoAchou = naTela && alvos.length > 0 && !el && !procurando;
  const podeLevar = !naTela && Boolean(destino);
  // Na tela certa, mas noutra aba dela: o ponto não aparece. Leva à aba certa
  // (só dentro da mesma tela — nunca de volta a uma lista).
  const recuo = naoAchou ? destinoDeRecuo(guia, idx, ctx) : null;
  const podeRecuar = Boolean(recuo) && recuo !== `${caminho}${location.search}`;
  // O formulário que este passo ensina foi fechado: volta ao passo que o abre,
  // desde que o botão que abre esteja à vista.
  const abridor = naoAchou && !podeRecuar ? passoQueAbre(guia, idx) : -1;
  const podeReabrir = abridor >= 0 && Boolean(encontrarAlvo(alvosDoPasso(guia.steps[abridor])));

  return (
    <Destaque el={naTela ? el : null} rect={naTela ? rect : null} tituloId={tituloId} chave={`${chave}:${naTela}`}>
      <p className="sr-only" aria-live="polite">{`Passo ${idx + 1} de ${total}: ${passo.title}`}</p>
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-baseline text-[11px] font-bold uppercase tracking-widest text-gray-400">
          <span className="min-w-0 truncate">{guia.title}</span>
          <span className="shrink-0 whitespace-nowrap">&nbsp;· {idx + 1} de {total}</span>
        </p>
        <button
          type="button"
          onClick={() => encerrarGuia()}
          aria-label="Sair do guia"
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <h2 id={tituloId} ref={tituloRef} tabIndex={-1} className="mt-1 font-display text-lg font-bold leading-tight text-ink outline-none">
        {passo.title}
      </h2>

      {naTela ? (
        <>
          {paragrafos(passo).map((t) => (
            <p key={t.slice(0, 48)} className="mt-1.5 text-sm leading-6 text-gray-600">{t}</p>
          ))}
          {passo.tip && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-paper px-3 py-2 text-xs leading-5 text-gray-600">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acid-dark" aria-hidden="true" />
              <span>{passo.tip}</span>
            </p>
          )}
          {passo.action && !naoAchou && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-acid px-3 py-1.5 text-xs font-bold text-ink">
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" /> {passo.action}
            </p>
          )}
          {naoAchou && (
            <div role="status" className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {podeRecuar && <p>Este ponto fica noutra parte desta tela.</p>}
              {podeReabrir && <p>Parece que o formulário foi fechado.</p>}
              {!podeRecuar && !podeReabrir && (
                <p>
                  Não encontrei este ponto na tela agora — ele pode depender de uma permissão sua, de algo que
                  ainda não existe (um jogo, uma reserva) ou de um cartão fechado. Dá para seguir mesmo assim.
                </p>
              )}
              {/* O caminho de volta mora junto do aviso que o explica. */}
              {podeRecuar && (
                <V2Button size="sm" variant="secondary" className="mt-2" onClick={() => navigate(recuo)}>Levar-me até lá</V2Button>
              )}
              {podeReabrir && (
                <V2Button size="sm" variant="secondary" className="mt-2" onClick={() => irParaPasso(abridor)}>Abrir de novo</V2Button>
              )}
            </div>
          )}
          {el && (
            <button
              type="button"
              onClick={() => focavel(el)?.focus()}
              className="sr-only focus:not-sr-only focus:mt-2 focus:inline-block focus:rounded-full focus:bg-paper focus:px-3 focus:py-1 focus:text-xs focus:font-semibold"
            >
              Ir até o ponto destacado
            </button>
          )}
        </>
      ) : (
        <p className="mt-1.5 flex items-start gap-2 text-sm leading-6 text-gray-600">
          <MapPin className="mt-1 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span>{passo.awayText || 'Este passo acontece em outra tela.'}</span>
        </p>
      )}

      <Progresso total={total} atual={idx} />

      <div className="mt-4 flex items-center justify-between gap-2">
        {idx > 0 ? (
          <V2Button variant="ghost" size="sm" onClick={() => irParaPasso(idx - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Voltar
          </V2Button>
        ) : <span />}
        <div className="flex items-center gap-2">
          {!naTela && podeLevar && (
            <V2Button size="sm" onClick={() => navigate(destino)}>Levar-me até lá</V2Button>
          )}
          {naTela && espera && !naoAchou && (
            <button
              type="button"
              onClick={avancar}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-500 underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
            >
              Pular
            </button>
          )}
          {(naTela && (!espera || naoAchou)) || (!naTela && !podeLevar) ? (
            <V2Button size="sm" onClick={avancar}>
              {ultimo ? (<><Check className="h-4 w-4" aria-hidden="true" /> Concluir</>) : (<>Próximo <ChevronRight className="h-4 w-4" aria-hidden="true" /></>)}
            </V2Button>
          ) : null}
        </div>
      </div>
    </Destaque>
  );
}
